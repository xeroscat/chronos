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
} from 'react-native-reanimated';
import { useTimelineStore } from '../../../store/useTimelineStore';
import { checkCollision, timeToSlot, durationToSlots } from '../../timeline/transformers/timeMath';

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

export const TaskForm: React.FC = () => {
  // --- Consumir Zustand ---
  const {
    isFormOpen,
    setFormOpen,
    activeTab,
    setActiveTab,
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
    reminderBefore,
    setReminderBefore,
    description,
    setDescription,
    reminderTime,
    setReminderTime,
    reminderDesc,
    setReminderDesc,
    editingEventId,
    blocks,
    saveTask,
    saveReminder,
    
    // Pickers states
    isEditingDesc,
    isEditingTime,
    isEditingDuration,
    isEditingAlert,
    setEditingDesc,
    setEditingTime,
    setEditingDuration,
    setEditingAlert,
    
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

  const [isVisible, setIsVisible] = useState(false);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  // --- Reanimated Shared Values (Efectos locales de animación) ---
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const keyboardOffsetValue = useSharedValue(0);

  // --- Controladores del Teclado ---
  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      const offset = e.endCoordinates.height - 100;
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
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { mass: 1, damping: 20, stiffness: 100 });
      backdropOpacity.value = withTiming(0, { duration: 250 });
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [isFormOpen, SCREEN_HEIGHT]);

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
  const handleSaveTaskSubmit = () => {
    const success = saveTask();
    if (!success) {
      Alert.alert(
        'Conflicto de Tiempo',
        'El bloque seleccionado se superpone con otra tarea existente. Por favor, ajusta la hora de inicio o la duración.',
        [{ text: 'Entendido' }]
      );
    }
  };

  const liveSlotInicio = timeToSlot(pickerHour, pickerMinute, pickerAmPm);
  const liveDuracionSlots = durationToSlots(pickerDurationHour, pickerDurationMin);
  const activeBlocksForCollision = blocks.filter(b => b.blockId !== editingEventId);
  const isColliding = checkCollision(liveSlotInicio, liveDuracionSlots, activeBlocksForCollision);

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
          style={[animatedCardStyle]}
          className="w-[322px] min-h-[350px] bg-[#D9D9D9] rounded-[24px] border border-black/5 p-0 overflow-hidden mb-6"
        >
          {/* Tab Bar */}
          <Animated.View layout={LinearTransition.springify().mass(0.8).damping(15).stiffness(120)} className="flex-row w-full h-[48px] items-end px-3">
            <TouchableOpacity
              onPress={() => setActiveTab('tareas')}
              className={activeTab === 'tareas' ? 'flex-1 h-[40px] bg-white rounded-t-[16px] items-center justify-center' : 'flex-1 h-[40px] bg-transparent items-center justify-center'}
            >
              <Text className={activeTab === 'tareas' ? 'text-[16px] font-normal text-slate-900' : 'text-[16px] font-normal text-black/50'}>Tarea</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('recordatorios')}
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
                      className="w-full h-[36px] bg-[#DFDFDF] rounded-full flex-row items-center justify-center mb-2"
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{startTime}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-black/50 mb-1">Recordar</Text>
                    <TouchableOpacity
                      onPress={() => setEditingAlert(true)}
                      className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center mb-2"
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{reminderBefore}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                    <TouchableOpacity
                      onPress={handleSaveTaskSubmit}
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
                      className="w-full h-[36px] bg-[#DFDFDF] rounded-full flex-row items-center justify-center mb-2"
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{reminderTime}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-black/50 mb-1">Recordar</Text>
                    <TouchableOpacity
                      onPress={() => setEditingAlert(true)}
                      className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center mb-2"
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{reminderBefore}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                    <TouchableOpacity
                      onPress={saveReminder}
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
                      className="w-full h-[36px] bg-[#DFDFDF] rounded-full flex-row items-center justify-center mb-2"
                    >
                      <Text className="text-[12px] font-medium text-slate-800">{duration}</Text>
                    </TouchableOpacity>

                    <Text className="text-[13px] text-center font-bold text-black/50 mb-1">Descripción</Text>
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
                      className="w-full h-[36px] bg-[#3F3F3F] rounded-full flex-row items-center justify-center"
                    >
                      <Text className="text-[12px] font-normal text-white">Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                    <View className="w-full h-[36px] mb-2" />

                    <Text className="text-[13px] text-center font-bold text-black/50 mb-1">Descripción</Text>
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
                      className="w-full h-[36px] bg-[#3F3F3F] rounded-full flex-row items-center justify-center"
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
                <TouchableOpacity onPress={() => setEditingDesc(false)} className="w-full h-[36px] bg-[#3F3F3F] rounded-full justify-center items-center">
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
                  <ScrollWheel items={['00m', '05m', '10m', '15m', '20m', '25m', '30m', '45m', '50m', '55m']} selectedValue={pickerDurationMin} onValueChange={setPickerDurationMin} />
                </View>
              </Animated.View>
            )}

            {/* Alert Picker Overlay */}
            {isEditingAlert && (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col">
                <View className="flex-row items-center justify-between mb-2">
                  <TouchableOpacity onPress={() => setEditingAlert(false)} className="p-2 -ml-2"><Text className="text-xl font-light text-slate-800">✕</Text></TouchableOpacity>
                  <Text className="text-sm font-normal text-slate-500">Notificación</Text>
                  <View className="w-[30px]" />
                </View>
                <View className="w-[280px] self-center mt-4 flex-row flex-wrap justify-between">
                  {['Al instante', '2m antes', '5m antes', '10m antes', '15m antes', '30m antes'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      onPress={() => {
                        setReminderBefore(option);
                        setEditingAlert(false);
                      }}
                      className={`w-[125px] h-[36px] rounded-full justify-center items-center mb-5 ${reminderBefore === option ? 'bg-[#DFDFDF] border border-transparent' : 'bg-white border border-slate-100'}`}
                    >
                      <Text className={`text-[12px] ${reminderBefore === option ? 'font-normal text-slate-800' : 'font-medium text-slate-500'}`}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </>
  );
};