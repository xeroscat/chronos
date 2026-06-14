import './global.css';
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
            <Text className="text-xs">☀️</Text>
            <Text className="text-xs font-bold">6</Text>
          </View>
        </View>
        
        {/* Center Container - 275px x 275px */}
        <View className="w-[275px] h-[275px] items-center justify-center relative">
          {/* Base Circle */}
          <View className="w-[275px] h-[275px] bg-[#DFDFDF] rounded-full absolute" />
          {/* Mask Circle */}
          <View className="w-[137px] h-[137px] bg-white rounded-full absolute items-center justify-center shadow-md" />
        </View>
        
        {/* Right Column - Sunset Pill */}
        <View className="flex-1 items-center justify-center">
          <View className="w-[26px] h-[40px] bg-[#D9D9D9] rounded-full items-center justify-center">
            <Text className="text-xs">🌙</Text>
            <Text className="text-xs font-bold">18</Text>
          </View>
        </View>
      </View>
      
      {/* TAB Info - Flex 1 */}
      <View className="flex-1 bg-slate-50" />
    </SafeAreaView>
  );
}
