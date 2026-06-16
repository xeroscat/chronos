import React from 'react';
import './global.css';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, Dimensions, TextInput, Keyboard, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { Canvas, Circle, Path, Skia, vec, Line } from '@shopify/react-native-skia';
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

const mockBlocks = [
  { blockId: '1', slotInicio: 84, duracionSlots: 18, pilarTipo: 'cuerpo' }, // 07:00 a 08:30 (Cuerpo - Naranja)
  { blockId: '2', slotInicio: 108, duracionSlots: 30, pilarTipo: 'productividad' }, // 09:00 a 11:30 (Productividad - Amarillo)
  { blockId: '3', slotInicio: 252, duracionSlots: 24, pilarTipo: 'personal' }, // 21:00 a 23:00 (Personal - Morado)
];

const PILLAR_COLORS = {
  cuerpo: '#FF5733',
  mente: '#33A1FF',
  productividad: '#FFC300',
  personal: '#34C759',
};

const PILLAR_RADII: Record<string, number> = {
  productividad: 126,
  mente: 110,
  cuerpo: 94,
  personal: 78,
};

const hoursData = [
  { label: '12', left: 58.5, top: 102.5 }, // Abajo (00:00 / 24:00)
  { label: '3',  left: 27,   top: 89.5 },  // Abajo-Izquierda (03:00)
  { label: '6',  left: 14,   top: 58.5 },  // Izquierda (06:00)
  { label: '9',  left: 27,   top: 27.5 },  // Arriba-Izquierda (09:00)
  { label: '12', left: 58.5, top: 14 },    // Arriba (12:00)
  { label: '3',  left: 90,   top: 27.5 },  // Arriba-Derecha (15:00)
  { label: '6',  left: 103,  top: 58.5 },  // Derecha (18:00)
  { label: '9',  left: 90,   top: 89.5 },  // Abajo-Derecha (21:00)
];

const createArcPath = (x: number, y: number, r: number, startAngle: number, sweepAngle: number) => {
  return Skia.PathBuilder.Make()
    .addArc({ x: x - r, y: y - r, width: r * 2, height: r * 2 }, startAngle, sweepAngle)
    .build();
};

interface ScrollWheelProps {
  items: string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  itemHeight?: number;
}

const ScrollWheel: React.FC<ScrollWheelProps> = ({
  items,
  selectedValue,
  onValueChange,
  itemHeight = 40,
}) => {
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [localIndex, setLocalIndex] = React.useState(items.indexOf(selectedValue));

  // 1. Arquitectura de Elementos Fantasma: Evita el paddingVertical buggeado en Android
  const paddedItems = ['', '', ...items, '', ''];

  React.useEffect(() => {
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
    const safeY = Math.max(0, y); // Evita cálculos negativos en el rebote
    const index = Math.round(safeY / itemHeight);
    
    if (index >= 0 && index < items.length) {
      if (index !== localIndex) {
        setLocalIndex(index);
      }
    }
  };

  // Solo actualiza el padre cuando la rueda se detiene por completo
  const handleMomentumEnd = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const safeY = Math.max(0, y);
    const index = Math.round(safeY / itemHeight);
    if (index >= 0 && index < items.length) {
      onValueChange(items[index]);
    }
  };

  // Si el usuario arrastra lento y suelta sin inercia, momentum no se dispara.
  // Lo capturamos aquí, pero SOLO si la velocidad es casi cero.
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
        decelerationRate="fast" // Fast es ideal para que el imán actúe rápido al final del giro
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleDragEnd}
        scrollEventThrottle={16}
        // Eliminamos paddingVertical, snapToAlignment y disableIntervalMomentum
      >
        {paddedItems.map((item, index) => {
          // El índice real de los datos está desfasado por los 2 elementos fantasma
          const realIndex = index - 2;
          const diff = Math.abs(realIndex - localIndex);
          
          let textClass = 'text-slate-200 text-sm font-light';
          if (item === '') {
            // Elementos fantasma invisibles
          } else if (diff === 0) {
            textClass = 'text-slate-900 text-2xl font-bold';
          } else if (diff === 1) {
            textClass = 'text-slate-400 text-lg font-medium';
          }
          
          return (
            <View key={index} style={{ height: itemHeight, justifyContent: 'center', alignItems: 'center' }}>
              <Text className={textClass}>{item}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default function App() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'tareas' | 'recordatorios'>('tareas');
  const [taskTitle, setTaskTitle] = useState('Nueva Tarea');
  const [selectedPilar, setSelectedPilar] = useState<'cuerpo' | 'mente' | 'productividad' | 'personal'>('productividad');
  const [isPilarSelectorOpen, setIsPilarSelectorOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  
  // Tarea states
  const [startTime, setStartTime] = useState('08:30');
  const [duration, setDuration] = useState('1h 30m');
  const [reminderBefore, setReminderBefore] = useState('5m');
  const [description, setDescription] = useState('');
  
  // Recordatorio states
  const [reminderTime, setReminderTime] = useState('15:15');
  const [reminderDesc, setReminderDesc] = useState('');
  
  // Description editor state
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  
  // Time picker states
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [pickerAmPm, setPickerAmPm] = useState<'AM' | 'PM'>('AM');
  const [pickerHour, setPickerHour] = useState('08');
  const [pickerMinute, setPickerMinute] = useState('30');
  
  // Duration picker states
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [pickerDurationHour, setPickerDurationHour] = useState('1h');
  const [pickerDurationMin, setPickerDurationMin] = useState('30m');
  
  // Alert picker state
  const [isEditingAlert, setIsEditingAlert] = useState(false);
  
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const keyboardOffsetValue = useSharedValue(0);

  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      const offset = e.endCoordinates.height - 100;
      setKeyboardOffset(offset);
      keyboardOffsetValue.value = withSpring(-offset, { mass: 1, damping: 20, stiffness: 100 });
    });
    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOffset(0);
      keyboardOffsetValue.value = withSpring(0, { mass: 1, damping: 20, stiffness: 100 });
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (isFormOpen) {
      setIsVisible(true);
      translateY.value = withSpring(0, { mass: 1, damping: 20, stiffness: 100 });
      backdropOpacity.value = withTiming(0, { duration: 330 });
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
  
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="light" />
      
      {/* Header Block - 50px height */}
      <View className="w-full h-[55px] bg-white" />
      
      {/* Chart Block - 275px height, full width */}
      <View className="flex-row items-center justify-between w-full h-[275px] mt-[15px]">
        {/* Left Column - Sunrise Pill */}
        <View className="flex-1 items-center justify-center">
          <View className="w-[26px] h-[40px] bg-[#D9D9D9] rounded-full items-center justify-center">
            <Image 
              source={require('./assets/sunrise.png')} 
              style={{ width: 16, height: 16 }} 
              resizeMode="contain"
            />
            <Text className="text-xs font-bold">6</Text>
          </View>
        </View>
        
        {/* Center Container - 275px x 275px */}
        <View className="w-[275px] h-[275px] items-center justify-center relative">
          <Canvas style={{ width: 275, height: 275 }}>
            {/* Layer 1: Base Circle */}
            <Circle c={vec(137.5, 137.5)} r={137.5} color="#DFDFDF" />
            
            {/* Layer 2: Task Blocks */}
            {mockBlocks.map((block) => {
              const startAngle = 90 + block.slotInicio * 1.25;
              const sweepAngle = block.duracionSlots * 1.25;
              const path = createArcPath(137.5, 137.5, 103, startAngle, sweepAngle);
              const color = PILLAR_COLORS[block.pilarTipo];
              
              return (
                <Path
                  key={block.blockId}
                  path={path}
                  style="stroke"
                  strokeWidth={69}
                  strokeCap="butt"
                  color={color}
                />
              );
            })}
            
            {/* Layer 4: Central Mask Circle */}
            <Circle c={vec(137.5, 137.5)} r={68.5} color="white" />
            
            {/* Midnight Line - 6 o'clock position */}
            <Line p1={vec(137.5, 206)} p2={vec(137.5, 275)} color="white" strokeWidth={3} />
          </Canvas>
          
          {/* Guide Time Texts */}
          <View className="w-[137px] h-[137px] rounded-full absolute items-center justify-center">
            {hoursData.map((hour, index) => (
              <Text
                key={`${hour.label}-${index}`}
                style={{ left: hour.left, top: hour.top }}
                className="absolute text-[12px] font-light text-slate-900 text-center w-[20px] h-[20px]"
              >
                {hour.label}
              </Text>
            ))}
          </View>
        </View>
        
        {/* Right Column - Sunset Pill */}
        <View className="flex-1 items-center justify-center">
          <View className="w-[26px] h-[40px] bg-[#D9D9D9] rounded-full items-center justify-center">
            <Image 
              source={require('./assets/sunset.png')} 
              style={{ width: 16, height: 16 }} 
              resizeMode="contain"
            />
            <Text className="text-xs font-bold">18</Text>
          </View>
        </View>
      </View>
      
      {/* TAB Info - Flex 1 */}
      <View className="flex-1 bg-slate-50" />
      
      {/* Floating Action Button (FAB) */}
      {!isFormOpen && (
        <TouchableOpacity
          className="absolute z-30 top-[365px] right-[35px] w-[44px] h-[44px] rounded-full items-center justify-center bg-slate-300 border border-white/20"
          onPress={() => setIsFormOpen(true)}
        >
          <Image
            source={require('./assets/plus.png')}
            style={{ width: 18, height: 18 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
      
      {/* Form Layer */}
      {isVisible && (
        <>
          {/* Backdrop */}
          <Pressable
            onPress={() => setIsFormOpen(false)}
            className="absolute inset-0 z-40"
          >
            <Animated.View style={animatedBackdropStyle} className="absolute inset-0 bg-black/30" />
          </Pressable>
          
          <View
            style={{ position: 'absolute', inset: 0, justifyContent: 'flex-end', alignItems: 'center', zIndex: 50 }}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[animatedCardStyle]}
              className="w-[322px] min-h-[350px] bg-[#E0E0E0] rounded-[24px] shadow-2xl border border-black/5 p-0 overflow-hidden mb-6"
            >
            {/* Tab Bar */}
            <Animated.View layout={LinearTransition.springify().mass(0.8).damping(15).stiffness(120)} className="flex-row w-full h-[48px] items-end px-3">
              <TouchableOpacity
                onPress={() => setActiveTab('tareas')}
                className={activeTab === 'tareas' ? 'flex-1 h-[40px] bg-white rounded-t-[16px] items-center justify-center' : 'flex-1 h-[40px] bg-transparent items-center justify-center'}
              >
                <Text className={activeTab === 'tareas' ? 'text-[16px] font-normal text-slate-900' : 'text-[16px] font-normal text-slate-500'}>Tarea</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('recordatorios')}
                className={activeTab === 'recordatorios' ? 'flex-1 h-[40px] bg-white rounded-t-[16px] items-center justify-center' : 'flex-1 h-[40px] bg-transparent items-center justify-center'}
              >
                <Text className={activeTab === 'recordatorios' ? 'text-[16px] font-normal text-slate-900' : 'text-[16px] font-normal text-slate-500'}>Recordatorio</Text>
              </TouchableOpacity>
            </Animated.View>
            
            {/* Internal White Card (Body) */}
            <Animated.View layout={LinearTransition.springify().mass(0.8).damping(15).stiffness(120)} className="w-full bg-white p-4 flex-1 rounded-b-[24px]">
              {/* Header */}
              <View className="flex-row items-center justify-between h-[36px] w-full">
                {/* Left: Editable Title */}
                <TextInput
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  className="text-lg font-normal text-slate-900 bg-transparent p-0 m-0 flex-1"
                />
                
                {/* Right: Pilar Selector */}
                <View className="flex-row items-center justify-end">
                  {!isPilarSelectorOpen ? (
                    <TouchableOpacity
                      onPress={() => setIsPilarSelectorOpen(true)}
                      className="flex-row items-center"
                      style={{ gap: 8 }}
                    >
                      <Text className="text-base font-normal text-slate-500">
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
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedPilar('cuerpo');
                          setIsPilarSelectorOpen(false);
                        }}
                        className="w-[26px] h-[26px] rounded-full"
                        style={{ backgroundColor: PILLAR_COLORS.cuerpo }}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedPilar('productividad');
                          setIsPilarSelectorOpen(false);
                        }}
                        className="w-[26px] h-[26px] rounded-full"
                        style={{ backgroundColor: PILLAR_COLORS.productividad }}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedPilar('personal');
                          setIsPilarSelectorOpen(false);
                        }}
                        className="w-[26px] h-[26px] rounded-full"
                        style={{ backgroundColor: PILLAR_COLORS.personal }}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedPilar('mente');
                          setIsPilarSelectorOpen(false);
                        }}
                        className="w-[26px] h-[26px] rounded-full"
                        style={{ backgroundColor: PILLAR_COLORS.mente }}
                      />
                    </Animated.View>
                  )}
                </View>
              </View>
              
              {/* Divider Line */}
              <View className="h-[1px] w-[284px] bg-slate-200 self-center mt-3" />
              
              {/* Two-Column Form Grid */}
              <View className="flex-row justify-between w-[280px] self-center mt-4">
                {/* Left Column */}
                <View className="w-[125px]">
                  {activeTab === 'tareas' ? (
                    <>
                      {/* Hora de inicio */}
                      <Text className="text-[13px] font-normal text-center text-slate-400 mb-1">Hora de inicio</Text>
                      <TouchableOpacity
                        onPress={() => setIsEditingTime(true)}
                        className="w-full h-[36px] bg-[#DFDFDF] rounded-full flex-row items-center justify-center shadow-sm mb-2"
                      >
                        <Text className="text-[12px] font-medium text-slate-800">{startTime}</Text>
                      </TouchableOpacity>
                      
                      {/* Recordar */}
                      <Text className="text-[13px] text-center font-normal text-slate-400 mb-1">Recordar</Text>
                      <TouchableOpacity
                        onPress={() => setIsEditingAlert(true)}
                        className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center shadow-sm mb-2"
                      >
                        <Text className="text-[12px] font-medium text-slate-800">{reminderBefore}</Text>
                      </TouchableOpacity>
                      
                      {/* Guardar Button */}
                      <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                      <TouchableOpacity className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center shadow-sm">
                        <Text className="text-[12px] font-normal text-slate-800">Guardar</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {/* Hora */}
                      <Text className="text-[13px] text-center font-normal text-slate-400 mb-1">Hora</Text>
                      <TouchableOpacity
                        onPress={() => setIsEditingTime(true)}
                        className="w-full h-[36px] bg-[#DFDFDF] rounded-full flex-row items-center justify-center shadow-sm mb-2"
                      >
                        <Text className="text-[12px] font-medium text-slate-800">{reminderTime}</Text>
                      </TouchableOpacity>
                      
                      {/* Recordar */}
                      <Text className="text-[13px] text-center font-normal text-slate-400 mb-1">Recordar</Text>
                      <TouchableOpacity
                        onPress={() => setIsEditingAlert(true)}
                        className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center shadow-sm mb-2"
                      >
                        <Text className="text-[12px] font-medium text-slate-800">{reminderBefore}</Text>
                      </TouchableOpacity>
                      
                      {/* Guardar Button */}
                      <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                      <TouchableOpacity className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center shadow-sm">
                        <Text className="text-[12px] font-normal text-slate-800">Guardar</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                
                {/* Right Column */}
                <View className="w-[125px]">
                  {activeTab === 'tareas' ? (
                    <>
                      {/* Duración */}
                      <Text className="text-[13px] text-center font-normal text-slate-400 mb-1">Duración</Text>
                      <TouchableOpacity
                        onPress={() => setIsEditingDuration(true)}
                        className="w-full h-[36px] bg-[#DFDFDF] rounded-full flex-row items-center justify-center shadow-sm mb-2"
                      >
                        <Text className="text-[12px] font-medium text-slate-800">{duration}</Text>
                      </TouchableOpacity>
                      
                      {/* Descripción */}
                      <Text className="text-[13px] text-center font-botdext-slate-400 mb-1">Descripción</Text>
                      <TouchableOpacity
                        onPress={() => setIsEditingDesc(true)}
                        className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center shadow-sm mb-2"
                      >
                        <Text className="text-[12px] font-medium text-slate-800">Add</Text>
                        <Image
                          source={require('./assets/plus.png')}
                          style={{ width: 12, height: 12, marginLeft: 8 }}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                      
                      {/* Cancelar Button */}
                      <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                      <TouchableOpacity
                        onPress={() => setIsFormOpen(false)}
                        className="w-full h-[36px] bg-[#3F3F3F] rounded-full flex-row items-center justify-center shadow-sm"
                      >
                        <Text className="text-[12px] font-normal text-white">Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {/* Empty space for balance */}
                      <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                      <View className="w-full h-[36px] mb-2" />
                      
                      {/* Descripción */}
                      <Text className="text-[13px] text-center font-botdext-slate-400 mb-1">Descripción</Text>
                      <TouchableOpacity
                        onPress={() => setIsEditingDesc(true)}
                        className="w-full h-[36px] bg-white border border-slate-100 rounded-full flex-row items-center justify-center shadow-sm mb-2"
                      >
                        <Text className="text-[12px] font-medium text-slate-800">Add</Text>
                        <Image
                          source={require('./assets/plus.png')}
                          style={{ width: 12, height: 12, marginLeft: 8 }}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                      
                      {/* Cancelar Button */}
                      <Text className="text-[13px] text-center font-normal text-slate-400 mb-1"> </Text>
                      <TouchableOpacity
                        onPress={() => setIsFormOpen(false)}
                        className="w-full h-[36px] bg-[#3F3F3F] rounded-full flex-row items-center justify-center shadow-sm"
                      >
                        <Text className="text-[12px] font-normal text-white">Cancel</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
              
              {/* Description Editor (iOS-style full screen animation) */}
              {isEditingDesc && (
                <Animated.View
                  entering={FadeIn.duration(250)}
                  exiting={FadeOut.duration(150)}
                  className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col"
                >
                  <Text className="text-sm font-normal text-slate-400 mb-2">Descripción de la Tarea</Text>
                  <TextInput
                    className="flex-1 text-slate-900 text-sm py-2"
                    multiline
                    placeholder="Escribe aquí los detalles ..."
                    value={description}
                    onChangeText={setDescription}
                    autoFocus
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    onPress={() => setIsEditingDesc(false)}
                    className="w-full h-[36px] bg-[#3F3F3F] rounded-full justify-center items-center"
                  >
                    <Text className="text-[12px] font-normal text-white">Listo</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
              
              {/* Time Picker Overlay */}
              {isEditingTime && (
                <Animated.View
                  entering={FadeIn.duration(250)}
                  exiting={FadeOut.duration(150)}
                  className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col"
                >
                  <View className="flex-row items-center justify-between mb-4">
                    <TouchableOpacity onPress={() => setIsEditingTime(false)}>
                      <Text className="text-2xl font-normal text-slate-800">✕</Text>
                    </TouchableOpacity>
                    <Text className="text-lg font-normal text-slate-900">Hora de inicio</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const timeValue = `${pickerHour}:${pickerMinute} ${pickerAmPm}`;
                        if (activeTab === 'tareas') {
                          setStartTime(timeValue);
                        } else {
                          setReminderTime(timeValue);
                        }
                        setIsEditingTime(false);
                      }}
                    >
                      <Text className="text-2xl font-normal text-slate-800">✓</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="flex-1 flex-row justify-center items-center gap-4">
                    <ScrollWheel

                      items={['AM', 'PM']}
                      selectedValue={pickerAmPm}
                      onValueChange={(value) => setPickerAmPm(value as 'AM' | 'PM')}
                    />
                    <ScrollWheel
                      items={['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']}
                      selectedValue={pickerHour}
                      onValueChange={setPickerHour}
                    />
                    <ScrollWheel
                      items={['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']}
                      selectedValue={pickerMinute}
                      onValueChange={setPickerMinute}
                    />
                  </View>
                </Animated.View>
              )}
              
              {/* Duration Picker Overlay */}
              {isEditingDuration && (
                <Animated.View
                  entering={FadeIn.duration(250)}
                  exiting={FadeOut.duration(150)}
                  className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col"
                >
                  <View className="flex-row items-center justify-between mb-4">
                    <TouchableOpacity onPress={() => setIsEditingDuration(false)}>
                      <Text className="text-2xl font-normal text-slate-800">✕</Text>
                    </TouchableOpacity>
                    <Text className="text-lg font-normal text-slate-900">Duración</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setDuration(`${pickerDurationHour} ${pickerDurationMin}`);
                        setIsEditingDuration(false);
                      }}
                    >
                      <Text className="text-2xl font-normal text-slate-800">✓</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="flex-1 flex-row justify-center items-center gap-4">
                    <ScrollWheel
                      items={['0h', '1h', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', '11h', '12h']}
                      selectedValue={pickerDurationHour}
                      onValueChange={setPickerDurationHour}
                    />
                    <ScrollWheel
                      items={['00m', '05m', '10m', '15m', '20m', '25m', '30m', '45m', '50m', '55m']}
                      selectedValue={pickerDurationMin}
                      onValueChange={setPickerDurationMin}
                    />
                  </View>
                </Animated.View>
              )}
              
              {/* Alert Picker Overlay */}
              {isEditingAlert && (
                <Animated.View
                  entering={FadeIn.duration(250)}
                  exiting={FadeOut.duration(150)}
                  className="absolute inset-0 bg-white rounded-[24px] p-5 z-50 flex-col"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <TouchableOpacity onPress={() => setIsEditingAlert(false)} className="p-2 -ml-2">
                      <Text className="text-xl font-light text-slate-800">✕</Text>
                    </TouchableOpacity>
                    <Text className="text-sm font-normal text-slate-500">Notificación</Text>
                    <View className="w-[30px]" />
                  </View>
                  
                  {/* Grid Flex-Wrap Simétrico */}
                  <View className="w-[280px] self-center mt-4 flex-row flex-wrap justify-between">
                    {['Al instante', '2m antes', '5m antes', '10m antes', '15m antes', '30m antes'].map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() => {
                          setReminderBefore(option);
                          setIsEditingAlert(false);
                        }}
                        className={`w-[125px] h-[36px] rounded-full justify-center items-center mb-5 shadow-sm ${
                          reminderBefore === option
                            ? 'bg-[#DFDFDF] border border-transparent'
                            : 'bg-white border border-slate-100'
                        }`}
                      >
                        <Text
                          className={`text-[12px] ${
                            reminderBefore === option ? 'font-normal text-slate-800' : 'font-medium text-slate-500'
                          }`}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}
            </Animated.View>
            </Animated.View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
