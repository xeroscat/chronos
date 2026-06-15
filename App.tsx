import './global.css';
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import { Canvas, Circle, Path, Skia, vec, Line } from '@shopify/react-native-skia';

const mockBlocks = [
  { blockId: '1', slotInicio: 84, duracionSlots: 18, pilarTipo: 'cuerpo' }, // 07:00 a 08:30 (Cuerpo - Naranja)
  { blockId: '2', slotInicio: 108, duracionSlots: 30, pilarTipo: 'productividad' }, // 09:00 a 11:30 (Productividad - Amarillo)
  { blockId: '3', slotInicio: 252, duracionSlots: 24, pilarTipo: 'personal' }, // 21:00 a 23:00 (Personal - Morado)
];

const PILLAR_COLORS = {
  cuerpo: '#FF5733',
  mente: '#33A1FF',
  productividad: '#FFC300',
  personal: '#8E44AD',
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
    </SafeAreaView>
  );
}
