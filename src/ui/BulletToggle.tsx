import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';

interface BulletToggleProps {
  isActive: boolean;
  onToggle: (newState: boolean) => void;
  size?: number;
  hideBackground?: boolean;
}

export const BulletToggle: React.FC<BulletToggleProps> = ({
  isActive,
  onToggle,
  size = 24,
  hideBackground = false,
}) => {
  const progress = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(isActive ? 1 : 0, {
      mass: 0.4,
      damping: 15,
      stiffness: 180,
    });
  }, [isActive]);

  const animatedBackgroundStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      ['rgb(217, 217, 217)', 'rgb(217, 217, 217)'],
      'RGB'
    );
    return {
      backgroundColor: hideBackground ? 'transparent' : backgroundColor,
    };
  });

  const animatedBulletStyle = useAnimatedStyle(() => {
    const bulletColor = interpolateColor(
      progress.value,
      [0, 1],
      ['rgb(255, 56, 60)', 'rgb(52, 199, 89)'], // Red cuando inactivo, verde cuando activo
      'RGB'
    );
    return {
      backgroundColor: bulletColor,
      transform: [{ scale: 1 }],
    };
  });

  const bulletSize = hideBackground ? size : Math.max(size * 0.35, 6);

  return (
    <TouchableOpacity
      onPress={() => onToggle(!isActive)}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          animatedBackgroundStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <Animated.View
          style={[
            animatedBulletStyle,
            {
              width: bulletSize,
              height: bulletSize,
              borderRadius: bulletSize / 2,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};
