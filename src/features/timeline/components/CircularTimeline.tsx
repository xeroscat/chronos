import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { Canvas, Circle, Path, Skia, vec, Line, Group, FractalNoise, ColorMatrix } from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import { useTimelineStore } from '../../../store/useTimelineStore';
import { timeToSlot, durationToSlots, checkCollision } from '../transformers/timeMath';

// Constantes visuales
const PILLAR_COLORS = {
  cuerpo: '#FF5733',
  mente: '#33A1FF',
  productividad: '#FFC300',
  personal: '#34C759',
};

const GRAYSCALE_MATRIX = [
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0, 0, 0, 1, 0,
];

const cx = 175;
const cy = 175;

const createArcPath = (x: number, y: number, r: number, startAngle: number, sweepAngle: number) => {
  return Skia.PathBuilder.Make()
    .addArc({ x: x - r, y: y - r, width: r * 2, height: r * 2 }, startAngle, sweepAngle)
    .build();
};

interface CircularTimelineProps {
  nowDate: Date;
  currentSlot: number;
}

export const CircularTimeline: React.FC<CircularTimelineProps> = ({ nowDate, currentSlot }) => {
  // --- Estado local para montaje escalonado (Staggered Mount) ---
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // --- Animación de Fade-In al montarse la gráfica ---
  const timelineOpacity = useSharedValue(0);

  useEffect(() => {
    if (isReady) {
      timelineOpacity.value = withTiming(1, { duration: 500 });
      bgBlocksOpacity.value = withTiming(isFormOpen ? 0.25 : 1, { duration: 500 });
    }
  }, [isReady]);

  const animatedTimelineStyle = useAnimatedStyle(() => {
    return {
      opacity: timelineOpacity.value,
    };
  });

  // --- Consumir estado global de Zustand ---
  const {
    blocks,
    reminders,
    isFormOpen,
    activeTab,
    selectedPilar,
    editingEventId,
    pickerHour,
    pickerMinute,
    pickerAmPm,
    pickerDurationHour,
    pickerDurationMin,
  } = useTimelineStore();

  // --- Valores animados para Reanimated ---
  const animatedStartAngle = useSharedValue(0);
  const animatedSweepAngle = useSharedValue(0);
  const animatedReminderRad = useSharedValue(0);
  
  const bgBlocksOpacity = useSharedValue(0);
  const previewTaskOpacity = useSharedValue(0);
  const previewReminderOpacity = useSharedValue(0);

  // --- Lógica y Matemática de Slots (Vistas Previas) ---
  const liveSlotInicio = timeToSlot(pickerHour, pickerMinute, pickerAmPm);
  const liveDuracionSlots = durationToSlots(pickerDurationHour, pickerDurationMin);
  
  const targetStartAngle = 90 + liveSlotInicio * 1.25;
  const targetSweepAngle = liveDuracionSlots * 1.25;
  const targetReminderRad = ((90 + liveSlotInicio * 1.25) * Math.PI) / 180;

  // Lógica de colisión local para cambiar el color de la vista previa en tiempo real
  const activeBlocksForCollision = blocks.filter(b => b.blockId !== editingEventId);
  const isColliding = checkCollision(liveSlotInicio, liveDuracionSlots, activeBlocksForCollision);
  const liveColor = isColliding ? '#FF3B30' : PILLAR_COLORS[selectedPilar];

  // Cálculos de la Aguja Actual (Minutos transcurridos fluyendo continuamente)
  const currentMinuteFloat = nowDate.getHours() * 60 + nowDate.getMinutes() + (nowDate.getSeconds() / 60);
  const currentAngle = 90 + (currentMinuteFloat * 0.25);
  const currentRad = (currentAngle * Math.PI) / 180;

  // Path para la sombra del tiempo transcurrido (Desde las 00:00 hasta la hora actual)
  const passedTimeSweep = currentMinuteFloat * 0.25;
  const passedTimePath = createArcPath(cx, cy, 103, 90, passedTimeSweep);

  // --- Efectos de Animación de Vista Previa ---
  useEffect(() => {
    if (animatedStartAngle.value === 0) {
      animatedStartAngle.value = targetStartAngle;
      animatedSweepAngle.value = targetSweepAngle;
      animatedReminderRad.value = targetReminderRad;
    } else {
      animatedStartAngle.value = withSpring(targetStartAngle, { mass: 0.8, damping: 15, stiffness: 120 });
      animatedSweepAngle.value = withSpring(targetSweepAngle, { mass: 0.8, damping: 15, stiffness: 120 });
      animatedReminderRad.value = withSpring(targetReminderRad, { mass: 0.8, damping: 15, stiffness: 120 });
    }
  }, [targetStartAngle, targetSweepAngle, targetReminderRad]);

  useEffect(() => {
    if (!isReady) return;

    if (isFormOpen) {
      bgBlocksOpacity.value = withTiming(0.25, { duration: 300 });
      if (activeTab === 'tareas') {
        previewTaskOpacity.value = withTiming(1, { duration: 250 });
        previewReminderOpacity.value = withTiming(0, { duration: 250 });
        animatedSweepAngle.value = withSpring(targetSweepAngle, { mass: 0.8, damping: 15, stiffness: 120 });
      } else {
        previewTaskOpacity.value = withTiming(0, { duration: 250 });
        previewReminderOpacity.value = withTiming(1, { duration: 250 });
        animatedSweepAngle.value = withSpring(0, { mass: 0.8, damping: 15, stiffness: 120 });
      }
    } else {
      bgBlocksOpacity.value = withTiming(1, { duration: 300 });
      previewTaskOpacity.value = withTiming(0, { duration: 200 });
      previewReminderOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isReady, isFormOpen, activeTab, targetSweepAngle]);

  // --- Derivar Paths y Vectores en el UI Thread ---
  const animatedLivePath = useDerivedValue(() => {
    'worklet';
    return Skia.PathBuilder.Make()
      .addArc(
        { x: cx - 103, y: cy - 103, width: 103 * 2, height: 103 * 2 }, 
        animatedStartAngle.value, 
        animatedSweepAngle.value
      )
      .build();
  });

  const reminderLineP1 = useDerivedValue(() => {
    'worklet';
    return vec(cx + 68.5 * Math.cos(animatedReminderRad.value), cy + 68.5 * Math.sin(animatedReminderRad.value));
  });
  
  const reminderLineP2 = useDerivedValue(() => {
    'worklet';
    return vec(cx + 137.5 * Math.cos(animatedReminderRad.value), cy + 137.5 * Math.sin(animatedReminderRad.value));
  });

  const reminderCircleC = useDerivedValue(() => {
    'worklet';
    return vec(cx + 142.5 * Math.cos(animatedReminderRad.value), cy + 142.5 * Math.sin(animatedReminderRad.value));
  });

  const animatedReminderTextStyle = useAnimatedStyle(() => {
    const xText = cx + 162 * Math.cos(animatedReminderRad.value);
    const yText = cy + 162 * Math.sin(animatedReminderRad.value);
    return {
      left: xText - 20,
      top: yText - 8,
      opacity: previewReminderOpacity.value,
    };
  });

  if (!isReady) {
    return <View className="w-[275px] h-[275px] rounded-full bg-slate-100" />;
  }

  return (
    <Animated.View 
      style={animatedTimelineStyle}
      className="w-[275px] h-[275px] items-center justify-center relative"
    >
      <Canvas style={{ width: 350, height: 350, position: 'absolute', left: -37.5, top: -37.5 }}>
        <Group opacity={timelineOpacity}>
          {/* Layer 1: Base Circle */}
          <Circle c={vec(cx, cy)} r={137.5} color="#D9D9D9" />
        
        {/* Layer 2: Saved Task Blocks */}
        <Group opacity={bgBlocksOpacity}>
          {activeBlocksForCollision.map((block) => {
            const startAngle = 90 + block.slotInicio * 1.25;
            const sweepAngle = block.duracionSlots * 1.25;
            const path = createArcPath(cx, cy, 103, startAngle, sweepAngle);
            const baseColor = PILLAR_COLORS[block.pilarTipo];
            
            return (
              <Path
                key={block.blockId}
                path={path}
                style="stroke"
                strokeWidth={69}
                strokeCap="butt"
                color={baseColor}
              />
            );
          })}
        </Group>

        {/* Layer 2.5: Sombra de Tiempo Transcurrido con Ruido Fractal */}
        <Group opacity={bgBlocksOpacity}>
          <Path path={passedTimePath} style="stroke" strokeWidth={69} strokeCap="butt" color="rgba(0, 0, 0, 0.4)" />
          <Group blendMode="softLight">
            <ColorMatrix matrix={GRAYSCALE_MATRIX} />
            <Path path={passedTimePath} style="stroke" strokeWidth={69} strokeCap="butt" color="white">
              <FractalNoise freqX={0.05} freqY={0.05} octaves={3} />
            </Path>
          </Group>
        </Group>

        {/* Layer 3: Live Preview (Task/Reminder) */}
        <Group opacity={previewTaskOpacity}>
          <Path path={animatedLivePath} style="stroke" strokeWidth={69} strokeCap="butt" color={liveColor} />
        </Group>

        <Group opacity={previewReminderOpacity}>
          <Line p1={reminderLineP1} p2={reminderLineP2} color={PILLAR_COLORS[selectedPilar]} strokeWidth={2.5} />
          <Circle c={reminderCircleC} r={5} color={PILLAR_COLORS[selectedPilar]} />
        </Group>

        {/* Layer 4: Central Mask Circle (Donut hole) */}
        <Circle c={vec(cx, cy)} r={68.5} color="white" />

        {/* Midnight Line (6 o'clock) */}
        <Line p1={vec(cx, cy + 68.5)} p2={vec(cx, cy + 137.5)} color="white" strokeWidth={3} />

        {/* Layer 4.5: Hour Tick Marks */}
        {Array.from({ length: 24 }).map((_, h) => {
          if (h % 3 === 0) return null; // Saltamos las horas principales
          const rad = ((90 + h * 15) * Math.PI) / 180;
          const rStart = 52;
          const rEnd = 58;
          return (
            <Line 
              key={`tick-${h}`}
              p1={vec(cx + rStart * Math.cos(rad), cy + rStart * Math.sin(rad))}
              p2={vec(cx + rEnd * Math.cos(rad), cy + rEnd * Math.sin(rad))}
              color="#CBD5E1" 
              strokeWidth={1.5}
              strokeCap="round"
            />
          );
        })}

        {/* Layer 5: Saved Reminders Lines & Pins */}
        {reminders.map((reminder) => {
          const rad = ((90 + reminder.slot * 1.25) * Math.PI) / 180;
          return (
            <React.Fragment key={reminder.id}>
              <Line 
                p1={vec(cx + 68.5 * Math.cos(rad), cy + 68.5 * Math.sin(rad))} 
                p2={vec(cx + 137.5 * Math.cos(rad), cy + 137.5 * Math.sin(rad))} 
                color={PILLAR_COLORS[reminder.pilarTipo]} 
                strokeWidth={2.5} 
              />
              <Circle 
                c={vec(cx + 142.5 * Math.cos(rad), cy + 142.5 * Math.sin(rad))} 
                r={5} 
                color={PILLAR_COLORS[reminder.pilarTipo]} 
              />
            </React.Fragment>
          );
        })}

          {/* Layer 6: Current Time needle */}
          <Group>
            <Line 
              p1={vec(cx + 68.5 * Math.cos(currentRad), cy + 68.5 * Math.sin(currentRad))}
              p2={vec(cx + 142.5 * Math.cos(currentRad), cy + 142.5 * Math.sin(currentRad))}
              color="white"
              strokeWidth={3}
            />
            <Circle 
              c={vec(cx + 142.5 * Math.cos(currentRad), cy + 142.5 * Math.sin(currentRad))}
              r={6}
              color="white"
            />
          </Group>
        </Group>
      </Canvas>

      {/* Guide Hour Numbers and Text Overlays */}
      <View className="absolute items-center justify-center" style={{ width: 350, height: 350, left: -37.5, top: -37.5 }}>
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
          const rad = ((90 + h * 15) * Math.PI) / 180;
          const rText = 52;
          const x = cx + rText * Math.cos(rad);
          const y = cy + rText * Math.sin(rad);
          const label = (h === 0 || h === 12) ? '12' : (h % 12).toString();
          
          return (
            <Text
              key={`hour-${h}`}
              style={{ left: x - 10, top: y - 10 }}
              className="absolute text-[12px] font-light text-slate-900 text-center w-[20px] h-[20px]"
            >
              {label}
            </Text>
          );
        })}

        {/* Saved Reminders Labels */}
        {reminders.map((reminder) => {
          const rad = ((90 + reminder.slot * 1.25) * Math.PI) / 180;
          const xText = cx + 162 * Math.cos(rad);
          const yText = cy + 162 * Math.sin(rad);
          return (
            <Text 
              key={`text-${reminder.id}`}
              className="absolute text-[11px] font-bold text-slate-800 text-center w-[40px] h-[16px]" 
              style={{ left: xText - 20, top: yText - 8 }}
            >
              {reminder.timeLabel.split(' ')[0]}
            </Text>
          );
        })}

        {/* Live Preview Reminder Label */}
        <Animated.Text 
          className="absolute text-[11px] font-bold text-slate-800 text-center w-[40px] h-[16px]" 
          style={animatedReminderTextStyle}
        >
          {pickerHour}:{pickerMinute}
        </Animated.Text>
      </View>
    </Animated.View>
  );
};
