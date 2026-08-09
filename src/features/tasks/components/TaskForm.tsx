import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Keyboard, ScrollView, Image, TouchableOpacity, Dimensions, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInRight,
  FadeOutRight,
  LinearTransition,
  FadeIn,
  FadeOut,
  interpolateColor,
} from 'react-native-reanimated';
import { useTimelineStore } from '../../../store/useTimelineStore';
import { useUIStore } from '../../../store/useUIStore';
import { useTaskStore } from '../../../store/taskStore';
import { checkCollision, timeToSlot, durationToSlots } from '../../timeline/transformers/timeMath';
import { BulletToggle } from '../../../ui/BulletToggle';
import {
  formToTask,
  formToReminder,
  formToNotification,
  RawTaskForm,
  RawReminderForm,
  normalizeNotifications,
  buildNotifPillLabel,
} from '../transformers/taskTransformer';
import { TipoAlerta } from '../../../types';

// Constantes de diseño
const PILLAR_COLORS = {
  cuerpo: '#FF5733',
  mente: '#33A1FF',
  productividad: '#FFC300',
  personal: '#34C759',
};

interface ScrollWheelProps {
  items: string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  itemHeight?: number;
}

// Rueda de selección estilo iOS integrada para máxima velocidad
const ScrollWheel: React.FC<ScrollWheelProps> = ({
  items,
  selectedValue,
  onValueChange,
  itemHeight = 40,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [localIndex, setLocalIndex] = useState(items.indexOf(selectedValue));
  const paddedItems = ['', '', ...items, '', ''];

  useEffect(() => {
    const initialIndex = items.indexOf(selectedValue);
    if (initialIndex !== -1) {
      setLocalIndex(initialIndex);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: initialIndex * itemHeight, animated: false });
      }, 100);
    }
  }, []);

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const safeY = Math.max(0, y);
    const index = Math.round(safeY / itemHeight);
    
    if (index >= 0 && index < items.length) {
      if (index !== localIndex) {
        setLocalIndex(index);
      }
    }
  };

  const handleMomentumEnd = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const safeY = Math.max(0, y);
    const index = Math.round(safeY / itemHeight);
    if (index >= 0 && index < items.length) {
      onValueChange(items[index]);
    }
  };

  const handleDragEnd = (event: any) => {
    const velocity = event.nativeEvent.velocity?.y || 0;
    if (Math.abs(velocity) < 0.1) {
      handleMomentumEnd(event);
    }
  };

  return (
    <View style={{ height: itemHeight * 5, width: 90, overflow: 'hidden' }}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleDragEnd}
        scrollEventThrottle={16}
      >
        {paddedItems.map((item, index) => {
          const realIndex = index - 2;
          const diff = Math.abs(realIndex - localIndex);
          
          let textClass = 'text-slate-200 text-sm font-light';
          if (item === '') {
            // Invisible spacers
          } else if (diff === 0) {
            textClass = 'text-slate-900 text-2xl font-bold';
          } else if (diff === 1) {
            textClass = 'text-slate-400 text-lg font-medium';
          }
          
          return (
            <View key={index} pointerEvents="none" style={{ height: itemHeight, justifyContent: 'center', alignItems: 'center' }}>
              <Text className={textClass}>{item}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const SlidingSwitch: React.FC<{ isActive: boolean; onToggle: (val: boolean) => void }> = ({ isActive, onToggle }) => {
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 100 });
  }, [isActive]);

  const trackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      ['rgb(239, 68, 68)', 'rgb(34, 197, 94)'],
      'RGB'
    );
    return { backgroundColor };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const translateX = withSpring(isActive ? 16 : 2, { 
      mass: 0.3,
      damping: 16, 
      stiffness: 300 
    });
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onToggle(!isActive)}
      style={{ width: 36, height: 20, borderRadius: 10, justifyContent: 'center' }}
    >
      <Animated.View style={[trackStyle, { width: 36, height: 20, borderRadius: 10, justifyContent: 'center' }]}>
        <Animated.View
          style={[
            thumbStyle,
            {
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: '#ffffff',
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

export const TaskForm: React.FC = () => {
  // --- Consumir Zustand ---
  const {
    taskTitle,
    setTaskTitle,
    selectedPilar,
    setSelectedPilar,
    isPilarSelectorOpen,
    setPilarSelectorOpen,
    startTime,
    setStartTime,
    duration,
    setDuration,
    description,
    setDescription,
    reminderTime,
    setReminderTime,
    reminderDesc,

    // Pickers states
    isEditingDesc,
    isEditingTime,
    isEditingDuration,
    isEditingAlert,
    isEditingAlertReminder,
    setEditingDesc,
    setEditingTime,
    setEditingDuration,
    setEditingAlert,
    setEditingAlertReminder,

    pickerHour,
    pickerMinute,
    pickerAmPm,
    pickerDurationHour,
    pickerDurationMin,
    setPickerHour,
    setPickerMinute,
    setPickerAmPm,
    setPickerDurationHour,
    setPickerDurationMin,
  } = useTimelineStore();

  const {
    saveTask,
    saveReminder,
    getTasksForDay,
    selectedDate,
    tasks,
    reminders,
  } = useTaskStore();

  const {
    isFormOpen,
    setFormOpen,
    activeTab,
    setActiveTab,
    editingEventId,
  } = useUIStore();

  // Local notification modal state
  const [notificationToggles, setNotificationToggles] = useState<Record<string, boolean>>({
    'Al iniciar': true,
    'Al terminar': false,
    '5m antes': false,
    '10m antes': false,
    '15m antes': false,
    '30m antes': false,
  });
  const [notificationType, setNotificationType] = useState<TipoAlerta>('push');
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(true);
  const notificationOpacity = useSharedValue(isNotificationEnabled ? 1 : 0.4);

  const resetNotificationState = () => {
    setNotificationToggles({
      'Al iniciar': true,
      'Al terminar': false,
      '5m antes': false,
      '10m antes': false,
      '15m antes': false,
      '30m antes': false,
    });
    setNotificationType('push');
    setIsNotificationEnabled(true);
  };

  useEffect(() => {
    notificationOpacity.value = withTiming(isNotificationEnabled ? 1 : 0.4, { duration: 200 });
  }, [isNotificationEnabled]);

  useEffect(() => {
    if (!editingEventId) return;

    const editingTask = tasks.find((t) => (t.id || t.blockId) === editingEventId) || reminders.find((r) => r.id === editingEventId);
    if (!editingTask) return;

    const {
      isNotificationEnabled: normalizedEnabled,
      notificationType: normalizedType,
      notificationToggles: normalizedToggles,
    } = normalizeNotifications(editingTask.recordatorio ?? []);

    setNotificationType(normalizedType);
    setIsNotificationEnabled(normalizedEnabled);

    const rebuiltToggles: Record<string, boolean> = {
      'Al iniciar': normalizedToggles.inicio ?? false,
      'Al terminar': normalizedToggles.fin ?? false,
      '5m antes': normalizedToggles.antes5 ?? false,
      '10m antes': normalizedToggles.antes10 ?? false,
      '15m antes': normalizedToggles.antes15 ?? false,
      '30m antes': normalizedToggles.antes30 ?? false,
    };

    setNotificationToggles(rebuiltToggles);
  }, [editingEventId, tasks, reminders]);

  const animatedNotificationStyle = useAnimatedStyle(() => {
    return {
      opacity: notificationOpacity.value,
    };
  });

  const [isVisible, setIsVisible] = useState(false);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  // --- Reanimated Shared Values (Efectos locales de animación) ---
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const keyboardOffsetValue = useSharedValue(0);

  // --- Controladores del Teclado ---
  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      const offset = e.endCoordinates.height - 50;
      keyboardOffsetValue.value = withSpring(-offset, { mass: 1, damping: 20, stiffness: 100 });
    });
    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
      keyboardOffsetValue.value = withSpring(0, { mass: 1, damping: 20, stiffness: 100 });
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  // --- Animación de Apertura/Cierre del Panel ---
  useEffect(() => {
    if (isFormOpen) {
      setIsVisible(true);
      translateY.value = withSpring(0, { mass: 1, damping: 20, stiffness: 100 });
      backdropOpacity.value = withTiming(0.3, { duration: 330 });

      if (!editingEventId) {
        resetNotificationState();
      }
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { mass: 1, damping: 20, stiffness: 100 });
      backdropOpacity.value = withTiming(0, { duration: 250 });
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [isFormOpen, SCREEN_HEIGHT, editingEventId]);

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value + keyboardOffsetValue.value }],
    };
  });

  const animatedBackdropStyle = useAnimatedStyle(() => {
    return {
      opacity: backdropOpacity.value,
    };
  });

  // --- Lógica de Negocio al Guardar ---
  const handleSaveTaskSubmit = async () => {
    if (activeTab === 'tareas') {
      // Transformar raw form a Tasks
      const existingTask = tasks.find((t) => (t.id || t.blockId) === editingEventId);
      const notifConfigs = formToNotification(
        isNotificationEnabled,
        notificationType,
        notificationToggles,
        existingTask?.recordatorio ?? []
      );
      const rawTaskForm: RawTaskForm = {
        pickerHour,
        pickerMinute,
        pickerAmPm,
        pickerDurationHour,
        pickerDurationMin,
        selectedPilar,
        taskTitle,
        description,
        editingEventId,
        parentId: null,
        fechaLocal: selectedDate,
        existingConfigs: existingTask?.recordatorio ?? [],
        // Notification fields
        isNotificationEnabled,
        notificationType,
        notificationToggles,
      };
      const task = formToTask(rawTaskForm);
      task.recordatorio = notifConfigs;
      await saveTask(task, editingEventId)
      setFormOpen(false)
    } else {
      // Transformar raw form a Reminder
      const existingReminder = reminders.find((r) => r.id === editingEventId);
      const notifConfigs = formToNotification(
        isNotificationEnabled,
        notificationType,
        notificationToggles,
        existingReminder?.recordatorio ?? []
      );
      const rawReminderForm: RawReminderForm = {
        pickerHour,
        pickerMinute,
        pickerAmPm,
        selectedPilar,
        reminderDesc,
        editingEventId,
        fechaLocal: selectedDate,
        existingConfigs: existingReminder?.recordatorio ?? [],
        // Notification fields
        isNotificationEnabled,
        notificationType,
        notificationToggles,
      };
      const reminder = formToReminder(rawReminderForm);
      reminder.recordatorio = notifConfigs;
      saveReminder(reminder, editingEventId);
      setFormOpen(false);
    }
  };

  const liveSlotInicio = timeToSlot(pickerHour, pickerMinute, pickerAmPm);
  const liveDuracionSlots = durationToSlots(pickerDurationHour, pickerDurationMin);
  const activeTasksForCollision = getTasksForDay().filter(t => (t.id || t.blockId) !== editingEventId);
  const isColliding = checkCollision(liveSlotInicio, liveDuracionSlots, activeTasksForCollision);
  const notificationSummaryLabel = buildNotifPillLabel(
    isNotificationEnabled,
    formToNotification(isNotificationEnabled, notificationType, notificationToggles)
  );

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <Pressable
        onPress={() => setFormOpen(false)}
        className="absolute inset-0 z-40"
      >
        <Animated.View style={animatedBackdropStyle} className="absolute inset-0 bg-black" />
      </Pressable>

      <View
        style={{ position: 'absolute', inset: 0, justifyContent: 'flex-end', alignItems: 'center', zIndex: 50 }}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            animatedCardStyle,
            {
              width: 322,
              minHeight: 350,
              backgroundColor: 'rgb(217, 217, 217)',
              borderRadius: 24,
              borderColor: 'rgba(0, 0, 0, 0.05)',
              borderWidth: 1,
              paddingVertical: 0,
              paddingHorizontal: 0,
              marginBottom: 24,
            },
          ]}
        >
          {/* Tab Bar */}
          <Animated.View layout={LinearTransition.springify().mass(0.8).damping(15).stiffness(120)} className="flex-row w-full h-[48px] items-end px-3">
            <TouchableOpacity
              onPress={() => {
                const anySubFormOpen =
                  isEditingAlertReminder ||
                  isEditingDesc ||
                  isEditingTime ||
                  isEditingDuration ||
                  isEditingAlert
                if (anySubFormOpen) return
                setActiveTab('tareas')
              }}
              className={activeTab === 'tareas' ? 'flex-1 h-[40px] bg-white rounded-t-[16px] items-center justify-center' : 'flex-1 h-[40px] bg-transparent items-center justify-center'}
            >
              <Text className={activeTab === 'tareas' ? 'text-[16px] font-normal text-slate-900' : 'text-[16px] font-normal text-black/50'}>Tarea</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const anySubFormOpen =
                  isEditingAlertReminder ||
                  isEditingDesc ||
                  isEditingTime ||
                  isEditingDuration ||
                  isEditingAlert
                if (anySubFormOpen) return
                setActiveTab('recordatorios')
              }}
              className={activeTab === 'recordatorios' ? 'flex-1 h-[40px] bg-white rounded-t-[16px] items-center justify-center' : 'flex-1 h-[40px] bg-transparent items-center justify-center'}
            >
              <Text className={activeTab === 'recordatorios' ? 'text-[16px] font-normal text-slate-900' : 'text-[16px] font-normal text-black/50'}>Recordatorio</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Internal White Card */}
          <Animated.View layout={LinearTransition.springify().mass(0.8).damping(15).stiffness(120)} className="w-full bg-white p-4 flex-1 rounded-b-[24px]">
            {/* Header */}
            <View className="flex-row items-center justify-between h-[36px] w-full">
              <TextInput
                value={taskTitle}
                onChangeText={setTaskTitle}
                className="text-lg font-normal text-slate-900 bg-transparent p-0 m-0 flex-1"
              />

              {/* Pilar Selector */}
              <View className="flex-row items-center justify-end">
                {!isPilarSelectorOpen ? (
                  <TouchableOpacity
                    onPress={() => setPilarSelectorOpen(true)}
                    className="flex-row items-center"
                    style={{ gap: 8 }}
                  >
                    <Text className="text-base font-normal text-black/50">
                      {selectedPilar.charAt(0).toUpperCase() + selectedPilar.slice(1)}
                    </Text>
                    <View className="w-[28px] h-[28px] rounded-full" style={{ backgroundColor: PILLAR_COLORS[selectedPilar] }} />
                  </TouchableOpacity>
                ) : (
                  <Animated.View
                    entering={FadeInRight.springify().mass(0.5).damping(12).stiffness(150)}
                    exiting={FadeOutRight.springify().mass(0.5).damping(12).stiffness(150)}
                    layout={LinearTransition.springify().mass(0.5).damping(12).stiffness(150)}
                    className="flex-row items-center bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200"
                    style={{ gap: 8 }}
                  >
                    {Object.keys(PILLAR_COLORS).map((key) => (
                      <TouchableOpacity
                        key={key}
                        onPress={() => {
                          setSelectedPilar(key as any);
                          setPilarSelectorOpen(false);
                        }}
                        className="w-[26px] h-[26px] rounded-full"
                        style={{ backgroundColor: PILLAR_COLORS[key as keyof typeof PILLAR_COLORS] }}
                      />
                    ))}
                  </Animated.View>
                )}
              </View>
            </View>

            {/* Divider */}
            <View className="h-[1px] w-[284px] bg-slate-200 self-center mt-3" />

            {/* Grid */}
            <View className="flex-row justify-between w-[280px] self-center mt-4">
              {/* Left Column */}
              <View className="w-[125px]">
                {activeTab === 'tareas' ? (
                  <>
                    <Text className="text-[13px] font-normal text-center text-black/50 mb-1">Hora de inicio</Text>
                    <TouchableOpacity
                      onPress={() => setEditingTime(true)}
                      className="w-full h-[36px] rounded-full flex-row items-center justify-center mb-2"
                      style={{
                        backgroundColor: 'rgb(223, 223, 223)',
                      }}
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{startTime}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-black/50 mb-1">Recordar</Text>
                    <TouchableOpacity
                      onPress={() => setEditingAlert(true)}
                      className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center mb-2"
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{notificationSummaryLabel}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                    <TouchableOpacity
                      onPress={handleSaveTaskSubmit}
                      disabled={isColliding}
                      className={`w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center ${isColliding ? 'opacity-40' : ''}`}
                    >
                      <Text className="text-[12px] font-normal text-slate-800">Guardar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text className="text-[13px] text-center font-normal text-black/50 mb-1">Hora</Text>
                    <TouchableOpacity
                      onPress={() => setEditingTime(true)}
                      className="w-full h-[36px] rounded-full flex-row items-center justify-center mb-2"
                      style={{
                        backgroundColor: 'rgb(223, 223, 223)',
                      }}
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{reminderTime}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-black/50 mb-1">Recordar</Text>
                    <TouchableOpacity
                      onPress={() => setEditingAlertReminder(true)}
                      className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center mb-2"
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{notificationSummaryLabel}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                    <TouchableOpacity
                      onPress={handleSaveTaskSubmit}
                      disabled={isColliding}
                      className={`w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center ${isColliding ? 'opacity-40' : ''}`}
                    >
                      <Text className="text-[12px] font-normal text-slate-800">Guardar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Right Column */}
              <View className="w-[125px]">
                {activeTab === 'tareas' ? (
                  <>
                    <Text className="text-[13px] text-center font-normal text-black/50 mb-1">Duración</Text>
                    <TouchableOpacity
                      onPress={() => setEditingDuration(true)}
                      className="w-full h-[36px] rounded-full flex-row items-center justify-center mb-2"
                      style={{
                        backgroundColor: 'rgb(223, 223, 223)',
                      }}
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{duration}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-black/50 mb-1">Descripción</Text>
                    <TouchableOpacity
                      onPress={() => setEditingDesc(true)}
                      className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center mb-2"
                    >
                      <Text className="text-[12px] font-medium text-slate-800">Add</Text>
                      <Image source={require('../../../../assets/plus.png')} style={{ width: 12, height: 12, marginLeft: 8 }} resizeMode="contain" />
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                    <TouchableOpacity
                      onPress={() => setFormOpen(false)}
                      className="w-full h-[36px] rounded-full flex-row items-center justify-center"
                      style={{
                        backgroundColor: 'rgb(63, 63, 63)',
                      }}
                    >
                      <Text className="text-[12px] font-normal text-white">Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                    <View className="w-full h-[36px] mb-2" />

                    <Text className="text-[13px] text-center font-normal text-black/50 mb-1">Descripción</Text>
                    <TouchableOpacity
                      onPress={() => setEditingDesc(true)}
                      className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center mb-2"
                    >
                      <Text className="text-[12px] font-medium text-slate-800">Add</Text>
                      <Image source={require('../../../../assets/plus.png')} style={{ width: 12, height: 12, marginLeft: 8 }} resizeMode="contain" />
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                    <TouchableOpacity
                      onPress={() => setFormOpen(false)}
                      className="w-full h-[36px] rounded-full flex-row items-center justify-center"
                      style={{
                        backgroundColor: 'rgb(63, 63, 63)',
                      }}
                    >
                      <Text className="text-[12px] font-normal text-white">Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Description Editor Screen */}
            {isEditingDesc && (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col">
                <Text className="text-sm font-normal text-black/50 mb-2">Descripción de la Tarea</Text>
                <TextInput
                  className="flex-1 text-slate-900 text-sm py-2"
                  multiline
                  placeholder="Escribe aquí los detalles ..."
                  value={description}
                  onChangeText={setDescription}
                  autoFocus
                  textAlignVertical="top"
                />
                <TouchableOpacity onPress={() => setEditingDesc(false)} className="w-full h-[36px] rounded-full justify-center items-center" style={{backgroundColor: 'rgb(63, 63, 63)'}}>
                  <Text className="text-[12px] font-normal text-white">Listo</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Time Picker Overlay */}
            {isEditingTime && (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col">
                <View className="flex-row items-center justify-between mb-4">
                  <TouchableOpacity onPress={() => setEditingTime(false)}><Text className="text-2xl font-normal text-slate-800">✕</Text></TouchableOpacity>
                  <Text className="text-lg font-normal text-slate-900">Hora de inicio</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const timeValue = `${pickerHour}:${pickerMinute} ${pickerAmPm}`;
                      if (activeTab === 'tareas') {
                        setStartTime(timeValue);
                      } else {
                        setReminderTime(timeValue);
                      }
                      setEditingTime(false);
                    }}
                  >
                    <Text className="text-2xl font-normal text-slate-800">✓</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-1 flex-row justify-center items-center gap-4">
                  <ScrollWheel items={['AM', 'PM']} selectedValue={pickerAmPm} onValueChange={(v) => setPickerAmPm(v as any)} />
                  <ScrollWheel items={['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']} selectedValue={pickerHour} onValueChange={setPickerHour} />
                  <ScrollWheel items={['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']} selectedValue={pickerMinute} onValueChange={setPickerMinute} />
                </View>
              </Animated.View>
            )}

            {/* Duration Picker Overlay */}
            {isEditingDuration && (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col">
                <View className="flex-row items-center justify-between mb-4">
                  <TouchableOpacity onPress={() => setEditingDuration(false)}><Text className="text-2xl font-normal text-slate-800">✕</Text></TouchableOpacity>
                  <Text className="text-lg font-normal text-slate-900">Duración</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setDuration(`${pickerDurationHour} ${pickerDurationMin}`);
                      setEditingDuration(false);
                    }}
                  >
                    <Text className="text-2xl font-normal text-slate-800">✓</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-1 flex-row justify-center items-center gap-4">
                  <ScrollWheel items={['0h', '1h', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', '11h', '12h']} selectedValue={pickerDurationHour} onValueChange={setPickerDurationHour} />
                  <ScrollWheel items={['00m', '05m', '10m', '15m', '20m', '25m', '30m','35m','40m', '45m', '50m', '55m']} selectedValue={pickerDurationMin} onValueChange={setPickerDurationMin} />
                </View>
              </Animated.View>
            )}

            {/* Alert Picker Overlay - NOTIFICATION MODAL REDESIGN */}
            {isEditingAlertReminder && (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col">
                {/* Header */}
                <View className="flex-row items-center w-full mb-1.5 px-1">
                  <TouchableOpacity onPress={() => setEditingAlertReminder(false)} className="p-2 -ml-2 mr-3">
                    <Text className="text-xl font-light text-slate-800">✕</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 14, fontWeight: '400', color: 'rgba(0, 0, 0, 0.5)' }}>Notificación</Text>
                  <View className="flex-1" />
                  <SlidingSwitch
                    isActive={isNotificationEnabled}
                    onToggle={setIsNotificationEnabled}
                  />
                </View>
                
                {/* Notifications Body with adjustable opacity */}
                <Animated.View 
                  style={[animatedNotificationStyle, { pointerEvents: isNotificationEnabled ? 'auto' : 'none' }]}
                  className="flex-1"
                >
                  
                  {/* Divider after pills */}
                  <View className="h-[1px] w-[250px] bg-slate-200 self-center mb-4" />

                  {/* Push and Alarm Buttons */}
                  <View className="w-[280px] self-center flex-row gap-3">
                    {/* Push Button */}
                    <TouchableOpacity
                      onPress={() => setNotificationType('push')}
                      className="flex-1 h-[44px] rounded-full justify-center items-center flex-row gap-2"
                      style={{
                        backgroundColor: notificationType === 'push' ? 'rgba(0, 0, 0, 0.6)' : 'rgb(255, 255, 255)',
                        borderWidth: notificationType === 'push' ? 0 : 1,
                        borderColor: 'rgb(226, 232, 240)',
                      }}
                    >
                      <Image 
                        source={notificationType === 'push' ? require('../../../../assets/push_active.png') : require('../../../../assets/push.png')} 
                        style={{ width: 18, height: 18 }} 
                        resizeMode="contain" 
                      />
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '400',
                        color: notificationType === 'push' ? 'rgb(255, 255, 255)' : 'rgba(0, 0, 0, 0.5)'
                      }}>Push</Text>
                    </TouchableOpacity>

                    {/* Alarm Button */}
                    <TouchableOpacity
                      onPress={() => setNotificationType('alarma')}
                      className="flex-1 h-[44px] rounded-full justify-center items-center flex-row gap-2"
                      style={{
                        backgroundColor: notificationType === 'alarma' ? 'rgba(0, 0, 0, 0.6)' : 'rgb(255, 255, 255)',
                        borderWidth: notificationType === 'alarma' ? 0 : 1,
                        borderColor: 'rgb(226, 232, 240)',
                      }}
                    >
                      <Image 
                        source={notificationType === 'alarma' ? require('../../../../assets/alarm_active.png') : require('../../../../assets/alarm.png')} 
                        style={{ width: 18, height: 18 }} 
                        resizeMode="contain" 
                      />
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '400',
                        color: notificationType === 'alarma' ? 'rgb(255, 255, 255)' : 'rgba(0, 0, 0, 0.5)'
                      }}>Alarma</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </Animated.View>
            )}
            {isEditingAlert && (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col">
                {/* Header */}
                <View className="flex-row items-center w-full mb-1.5 px-1">
                  <TouchableOpacity onPress={() => setEditingAlert(false)} className="p-2 -ml-2 mr-3">
                    <Text className="text-xl font-light text-slate-800">✕</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 14, fontWeight: '400', color: 'rgba(0, 0, 0, 0.5)' }}>Notificación</Text>
                  <View className="flex-1" />
                  <SlidingSwitch
                    isActive={isNotificationEnabled}
                    onToggle={setIsNotificationEnabled}
                  />
                </View>

                {/* Divider below header */}
                <View className="h-[1px] w-[250px] bg-slate-200 self-center mb-3" />

                {/* Notifications Body with adjustable opacity */}
                <Animated.View 
                  style={[animatedNotificationStyle, { pointerEvents: isNotificationEnabled ? 'auto' : 'none' }]}
                  className="flex-1"
                >
                  {/* 6 Notification Pills */}
                  <View className="w-[280px] self-center flex-row flex-wrap justify-between mb-4">
                    {['Al iniciar', 'Al terminar', '5m antes', '10m antes', '15m antes', '30m antes'].map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() => {
                          setNotificationToggles(prev => ({
                            ...prev,
                            [option]: !prev[option]
                          }));
                          // NO cerramos el modal automáticamente
                        }}
                        className="w-[125px] h-[36px] rounded-full justify-between items-center px-4 mb-3 flex-row"
                        style={{
                          backgroundColor: notificationToggles[option] ? 'rgb(223, 223, 223)' : 'rgb(255, 255, 255)',
                          borderWidth: notificationToggles[option] ? 0 : 1,
                          borderColor: 'rgb(226, 232, 240)',
                        }}
                      >
                        <Text className="text-[12px] font-normal text-black/50 flex-1 text-left" numberOfLines={1}>{option}</Text>
                        <BulletToggle
                          isActive={notificationToggles[option] || false}
                          onToggle={(newState) => {
                            setNotificationToggles(prev => ({
                              ...prev,
                              [option]: newState
                            }));
                          }}
                          size={12}
                          hideBackground={true}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Divider after pills */}
                  <View className="h-[1px] w-[250px] bg-slate-200 self-center mb-4" />

                  {/* Push and Alarm Buttons */}
                  <View className="w-[280px] self-center flex-row gap-3">
                    {/* Push Button */}
                    <TouchableOpacity
                      onPress={() => setNotificationType('push')}
                      className="flex-1 h-[44px] rounded-full justify-center items-center flex-row gap-2"
                      style={{
                        backgroundColor: notificationType === 'push' ? 'rgba(0, 0, 0, 0.6)' : 'rgb(255, 255, 255)',
                        borderWidth: notificationType === 'push' ? 0 : 1,
                        borderColor: 'rgb(226, 232, 240)',
                      }}
                    >
                      <Image 
                        source={notificationType === 'push' ? require('../../../../assets/push_active.png') : require('../../../../assets/push.png')} 
                        style={{ width: 18, height: 18 }} 
                        resizeMode="contain" 
                      />
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '400',
                        color: notificationType === 'push' ? 'rgb(255, 255, 255)' : 'rgba(0, 0, 0, 0.5)'
                      }}>Push</Text>
                    </TouchableOpacity>

                    {/* Alarm Button */}
                    <TouchableOpacity
                      onPress={() => setNotificationType('alarma')}
                      className="flex-1 h-[44px] rounded-full justify-center items-center flex-row gap-2"
                      style={{
                        backgroundColor: notificationType === 'alarma' ? 'rgba(0, 0, 0, 0.6)' : 'rgb(255, 255, 255)',
                        borderWidth: notificationType === 'alarma' ? 0 : 1,
                        borderColor: 'rgb(226, 232, 240)',
                      }}
                    >
                      <Image 
                        source={notificationType === 'alarma' ? require('../../../../assets/alarm_active.png') : require('../../../../assets/alarm.png')} 
                        style={{ width: 18, height: 18 }} 
                        resizeMode="contain" 
                      />
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '400',
                        color: notificationType === 'alarma' ? 'rgb(255, 255, 255)' : 'rgba(0, 0, 0, 0.5)'
                      }}>Alarma</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </>
  );
};