import './global.css';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, Dimensions, TextInput, Keyboard } from 'react-native';
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

export default function App() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'tareas' | 'recordatorios'>('tareas');
  const [taskTitle, setTaskTitle] = useState('Nueva Tarea');
  const [selectedPilar, setSelectedPilar] = useState<'cuerpo' | 'mente' | 'productividad' | 'personal'>('productividad');
  const [isPilarSelectorOpen, setIsPilarSelectorOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const keyboardOffsetValue = useSharedValue(0);

  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      const offset = e.endCoordinates.height - 80;
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
            style={{ width: 14, height: 14 }}
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
                  className="text-lg font-bold text-slate-900 bg-transparent p-0 m-0 flex-1"
                />
                
                {/* Right: Pilar Selector */}
                <View className="flex-row items-center justify-end">
                  {!isPilarSelectorOpen ? (
                    <TouchableOpacity
                      onPress={() => setIsPilarSelectorOpen(true)}
                      className="flex-row items-center"
                      style={{ gap: 8 }}
                    >
                      <Text className="text-base font-bold text-slate-500">
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
            </Animated.View>
            </Animated.View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
