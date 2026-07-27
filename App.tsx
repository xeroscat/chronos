import React, { useState, useEffect } from 'react';
import './global.css';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  LinearTransition,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { PilarType } from './src/types';
import { supabase } from './src/core/supabase';
import AuthScreen from './src/features/auth/components/AuthScreen';
import { useTimelineStore } from './src/store/useTimelineStore';
import { useUIStore } from './src/store/useUIStore';
import { useTaskStore } from './src/store/taskStore';
import { CircularTimeline } from './src/features/timeline/components/CircularTimeline';
import { TaskForm } from './src/features/tasks/components/TaskForm';
import { Tasks, Reminder } from './src/types';
import { slotToTimeParts } from './src/features/timeline/transformers/timeMath';
import { getFilteredTasksWithAdjustedValues, getFilteredReminders } from './src/features/tasks/selectors';

type AdjustedTask = Tasks & { effectiveSlotInicio: number; effectiveDuracionSlots: number; isOverflow: boolean | null };
type UnifiedEvent = (AdjustedTask & { type: 'task'; sortSlot: number }) | (Reminder & { type: 'reminder'; sortSlot: number });

const PILLAR_COLORS: Record<PilarType, string> = { cuerpo: '#FF5733', mente: '#33A1FF', productividad: '#FFC300', personal: '#34C759' };

const getFormattedDate = () => {
  const d = new Date();
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Store actions and states
  const {
    openFormForNewTask,
    openFormForEdit,
  } = useTimelineStore();

  const {
    isFormOpen,
    isEditMode,
    setEditMode,
    expandedBlockId,
    setExpandedBlockId,
  } = useUIStore();

  const {
    fetchData,
    isLoading,
    clearData,
    deleteEvent,
    getFilteredTasks,
    selectedDate,
    tasks,
    reminders,
  } = useTaskStore();

  // Real-time clock state
  const [currentSlot, setCurrentSlot] = useState(0);
  const [nowDate, setNowDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowDate(d);
      const slot = Math.floor(((d.getHours() * 60) + d.getMinutes()) / 5);
      setCurrentSlot(slot);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // MODO OFFLINE: Cargar datos siempre, independientemente de sesión
    fetchData();
  }, [fetchData]);

  if (isAuthLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
        <Text className="text-xs font-semibold text-slate-400 mt-4">Cargando Chronos AI...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {!session ? (
        <Animated.View key="auth" exiting={FadeOut.duration(400)} className="flex-1">
          <AuthScreen />
        </Animated.View>
      ) : (
        <Animated.View key="app" entering={FadeIn.duration(500)} className="flex-1">
          {isLoading ? (
            <View className="flex-1 bg-white items-center justify-center">
              <ActivityIndicator size="large" color="#000000" />
              <Text className="text-xs font-semibold text-slate-400 mt-4">Cargando tu día inteligente...</Text>
            </View>
          ) : (
            <SafeAreaView className="flex-1 bg-white">
              <StatusBar style="light" />

      {/* Header Block */}
      <View className="w-full h-[55px] bg-white flex-row justify-between items-center px-[26px]">
        <Text className="text-[22px] font-bold text-black">Chronos</Text>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Text className="text-[15px] font-normal text-black/60">
            {getFormattedDate()}
          </Text>
          <TouchableOpacity 
            onPress={async () => {
              try {
                await supabase.auth.signOut();
              } catch (error) {
                console.error("Error al cerrar sesión:", error);
              }
            }}
            className="bg-red-50 px-3 py-1.5 rounded-full border border-red-100"
            activeOpacity={0.7}
          >
            <Text className="text-red-500 text-xs font-bold">Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart Block */}
      <View className="flex-row items-center justify-between w-full h-[275px] mt-[15px] mb-[35px] z-10">
        <View className="flex-1 items-center justify-center">
          <View className="w-[26px] h-[40px] bg-[#D9D9D9] rounded-full items-center justify-center">
            <Image source={require('./assets/sunrise.png')} style={{ width: 16, height: 16 }} resizeMode="contain" />
            <Text className="text-xs font-bold">6</Text>
          </View>
        </View>

        <CircularTimeline nowDate={nowDate} currentSlot={currentSlot} />

        <View className="flex-1 items-center justify-center">
          <View className="w-[26px] h-[40px] bg-[#D9D9D9] rounded-full items-center justify-center">
            <Image source={require('./assets/sunset.png')} style={{ width: 16, height: 16 }} resizeMode="contain" />
            <Text className="text-xs font-bold">18</Text>
          </View>
        </View>
      </View>

      {/* TAB Info */}
      <View className="flex-1 bg-white items-center pt-4 pb-8">
        {!isFormOpen && (
          <View className="w-[322px] bg-[#D9D9D9] rounded-[28px] p-5 flex-1 flex-col">
            <View className="flex-row justify-between items-center w-full mb-4">
              <Text className="text-[17px] font-bold text-black/50">Siguientes tareas</Text>
              <TouchableOpacity
                onPress={() => setEditMode(!isEditMode)}
                className="w-[44px] h-[44px] bg-white rounded-full items-center justify-center border-[3px] border-slate-200"
              >
                {isEditMode ? (
                  <Text className="text-slate-800 font-bold text-lg">✓</Text>
                ) : (
                  <Image source={require('./assets/edit.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 w-full" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              {(() => {
                const filteredTasks = getFilteredTasksWithAdjustedValues(tasks, selectedDate);
                const filteredReminders = getFilteredReminders(reminders, selectedDate);
                const unifiedEvents: UnifiedEvent[] = [
                  ...filteredTasks.map(t => ({ ...t, type: 'task' as const, sortSlot: t.effectiveSlotInicio })),
                  ...filteredReminders.map(r => ({ ...r, type: 'reminder' as const, sortSlot: r.slot }))
                ];

                const sortedEvents = unifiedEvents.sort((a, b) => {
                  const aIsActive = a.type === 'task' && currentSlot >= a.effectiveSlotInicio && currentSlot < (a.effectiveSlotInicio + a.effectiveDuracionSlots);
                  const bIsActive = b.type === 'task' && currentSlot >= b.effectiveSlotInicio && currentSlot < (b.effectiveSlotInicio + b.effectiveDuracionSlots);
                  const aIsPast = a.type === 'task' ? (a.effectiveSlotInicio + a.effectiveDuracionSlots <= currentSlot) : (a.sortSlot <= currentSlot);
                  const bIsPast = b.type === 'task' ? (b.effectiveSlotInicio + b.effectiveDuracionSlots <= currentSlot) : (b.sortSlot <= currentSlot);

                  if (aIsActive && !bIsActive) return -1;
                  if (!aIsActive && bIsActive) return 1;
                  if (!aIsPast && bIsPast) return -1;
                  if (aIsPast && !bIsPast) return 1;
                  return a.sortSlot - b.sortSlot;
                });

                return sortedEvents.map((event) => {
                  if (event.type === 'task') {
                    const block = event;
                    const effectiveSlotInicio = block.effectiveSlotInicio;
                    const effectiveDuracionSlots = block.effectiveDuracionSlots;
                    
                    const isActive = currentSlot >= effectiveSlotInicio && currentSlot < (effectiveSlotInicio + effectiveDuracionSlots);
                    
                    let countdown = '';
                    if (isActive) {
                      const endSlot = effectiveSlotInicio + effectiveDuracionSlots;
                      const endTime = endSlot * 5 * 60;
                      const currentTime = (nowDate.getHours() * 3600) + (nowDate.getMinutes() * 60) + nowDate.getSeconds();
                      const remainingSeconds = endTime - currentTime;
                      const hours = Math.floor(remainingSeconds / 3600);
                      const minutes = Math.floor((remainingSeconds % 3600) / 60);
                      const seconds = remainingSeconds % 60;
                      countdown = hours > 0 
                        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}` 
                        : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    }

                    let timeRange = '';
                    if (!isActive) {
                      const startHour = Math.floor((effectiveSlotInicio * 5) / 60);
                      const startMin = (effectiveSlotInicio * 5) % 60;
                      const endSlot = effectiveSlotInicio + effectiveDuracionSlots;
                      const endHour = Math.floor((endSlot * 5) / 60);
                      const endMin = (endSlot * 5) % 60;
                      timeRange = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')} - ${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
                    }

                    const aEnd = effectiveSlotInicio + effectiveDuracionSlots;
                    const isPast = aEnd <= currentSlot;

                    return (
                      <Animated.View
                        key={block.id}
                        layout={LinearTransition.springify().mass(0.8).damping(15).stiffness(120)}
                        className={`w-full rounded-[28px] mb-3 overflow-hidden ${!isActive && isPast ? 'opacity-40' : (!isActive ? 'opacity-80' : '')}`}
                        style={{ backgroundColor: PILLAR_COLORS[block.pilarTipo] }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => isEditMode ? openFormForEdit({ ...block, type: 'task' }) : setExpandedBlockId(expandedBlockId === block.id ? null : block.id)}
                          className="w-full min-h-[52px] flex-row items-center justify-between px-4 py-3"
                        >
                          <Text className="text-sm font-bold text-white" numberOfLines={1} ellipsizeMode="tail">
                            {block.title}
                          </Text>
                          <View className="flex-row items-center">
                            {isActive ? (
                              <>
                                <View className="w-2 h-2 bg-white rounded-full mr-2" />
                                <Text className="text-sm font-bold text-white">{countdown}</Text>
                              </>
                            ) : (
                              <Text className="text-[11px] text-white/80 font-medium">{timeRange}</Text>
                            )}
                            {isEditMode && (
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  deleteEvent(block.id, 'task');
                                }}
                                className="w-[28px] h-[28px] bg-red-500 rounded-full items-center justify-center ml-2 border-2 border-white"
                              >
                                <Text className="text-white font-bold text-xs">✕</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                        {expandedBlockId === block.id && (
                          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} className="px-4 pb-4 pt-1 border-t border-white/20">
                            <Text className="text-white/90 text-[13px] leading-5 mb-3">{block.description || 'Sin descripción detallada.'}</Text>
                            <View className="w-full bg-black/15 rounded-lg p-3 flex-row items-center justify-between">
                              <Text className="text-white/90 text-[11px] font-bold uppercase tracking-wider">recursos adjuntos</Text>
                              <Text className="text-white/50 text-[10px] font-bold">PRÓXIMAMENTE</Text>
                            </View>
                          </Animated.View>
                        )}
                      </Animated.View>
                    );
                  } else {
                    const reminder = event;
                    const isPast = currentSlot > reminder.slot;
                    const timeParts = slotToTimeParts(reminder.slot);
                    const timeLabel = `${timeParts.h}:${timeParts.m} ${timeParts.ampm}`;
                    return (
                      <TouchableOpacity
                        key={reminder.id}
                        onPress={() => isEditMode && openFormForEdit({ ...reminder, type: 'reminder' })}
                        className={`w-full h-[42px] border-[3px] border-white rounded-[25px] flex-row items-center justify-between px-4 mb-3 ${isPast ? 'opacity-40' : ''}`}
                        style={{ backgroundColor: PILLAR_COLORS[reminder.pilarTipo] }}
                      >
                        <Text className="text-sm font-bold text-white">{reminder.descripcion || 'Recordatorio'}</Text>
                        <View className="flex-row items-center">
                          <Text className="text-xs font-semibold text-white">{timeLabel.split(' ')[0]}</Text>
                          {isEditMode && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                deleteEvent(reminder.id, 'reminder');
                              }}
                              className="w-[28px] h-[28px] bg-red-500 rounded-full items-center justify-center ml-2 border-2 border-white"
                            >
                              <Text className="text-white font-bold text-xs">✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }
                });
              })()}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Bottom Menu Bar */}
      <View className="w-full h-[75px] bg-[#CDCDCD] flex-row justify-around items-center px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <TouchableOpacity key={`menu-btn-${i}`} className="w-[44px] h-[44px] rounded-full bg-[#D9D9D9] items-center justify-center" activeOpacity={0.7} />
        ))}
      </View>

      {/* FAB */}
      {!isFormOpen && (
        <TouchableOpacity
          className="absolute z-30 top-[350px] right-[35px] w-[44px] h-[44px] rounded-full items-center justify-center bg-white border-[3px] border-slate-200"
          onPress={openFormForNewTask}
        >
          <Image source={require('./assets/plus.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
        </TouchableOpacity>
      )}

        {/* Task Form Component */}
        <TaskForm />
      </SafeAreaView>
          )}
        </Animated.View>
      )}
    </View>
  );
}
