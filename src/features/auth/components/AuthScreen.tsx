import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  FadeIn, 
  FadeOut, 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';
import { supabase } from '../../../core/supabase';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Animaciones para el primer render de la pantalla
  const screenOpacity = useSharedValue(0);

  useEffect(() => {
    // Fade in suave de toda la pantalla al aparecer por primera vez
    screenOpacity.value = withTiming(1, { duration: 600 });
  }, []);

  const animatedScreenStyle = useAnimatedStyle(() => {
    return {
      opacity: screenOpacity.value,
    };
  });

  // --- LÓGICA DE NEGOCIO (SUPABASE) ---
  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Campos incompletos', 'Por favor, ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Modo Inicio de Sesión
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        // Modo Registro
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        Alert.alert('Cuenta creada', '¡Tu cuenta ha sido creada con éxito! Iniciando sesión...');
      }
    } catch (error: any) {
      Alert.alert('Error de autenticación', error.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Animated.View style={animatedScreenStyle} className="flex-1 justify-between px-6 pt-12 pb-6">
        
        {/* TOP: Brand Logo */}
        <View className="items-center mt-4">
          <Text className="text-[32px] font-bold text-slate-900 tracking-tight">Chronos AI</Text>
        </View>

        {/* MIDDLE: Form Container */}
        <View className="w-full" style={{ gap: 20 }}>
          
          {/* 👑 CONTENEDOR DE ALTURA FIJA: Evita que los inputs "salten" al cambiar de texto */}
          <View className="h-[90px] w-full items-center justify-center relative">
            {isLogin ? (
              <Animated.View 
                key="login-header" 
                entering={FadeIn.duration(250)} 
                exiting={FadeOut.duration(200)}
                className="absolute items-center w-full px-4"
              >
                <Text className="text-[24px] font-bold text-slate-900 text-center">
                  Inicia sesión
                </Text>
                <Text className="text-[14px] text-slate-500 text-center mt-2 leading-5">
                  Ingresa tu correo electrónico y contraseña
                </Text>
              </Animated.View>
            ) : (
              <Animated.View 
                key="signup-header" 
                entering={FadeIn.duration(250)} 
                exiting={FadeOut.duration(200)}
                className="absolute items-center w-full px-4"
              >
                <Text className="text-[24px] font-bold text-slate-900 text-center">
                  Crea una cuenta
                </Text>
                <Text className="text-[14px] text-slate-500 text-center mt-2 leading-5">
                  Ingresa tu correo electrónico para registrarte
                </Text>
              </Animated.View>
            )}
          </View>

          {/* INPUTS: Absolutamente alineados */}
          <View className="w-full" style={{ gap: 16 }}>
            <View className="w-full bg-white border border-slate-200 rounded-2xl h-[54px] justify-center px-4 shadow-sm shadow-slate-100">
              <TextInput
                placeholder="correo@dominio.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                className="text-slate-900 text-base p-0"
              />
            </View>

            <View className="w-full bg-white border border-slate-200 rounded-2xl h-[54px] justify-center px-4 shadow-sm shadow-slate-100">
              <TextInput
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                className="text-slate-900 text-base p-0"
              />
            </View>
          </View>


          {/* BOTÓN PRINCIPAL: Sin negrita, peso medio premium */}
          <TouchableOpacity
            onPress={handleAuth}
            disabled={loading}
            className="w-full h-[54px] bg-slate-950 rounded-2xl items-center justify-center shadow-lg shadow-slate-200"
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-base font-medium">
                Continuar
              </Text>
            )}
          </TouchableOpacity>

          {/* BOTÓN TOGGLE: Para cambiar entre Login y Sign Up */}
          <TouchableOpacity 
            onPress={() => setIsLogin(!isLogin)}
            className="align-center py-2"
            activeOpacity={0.7}
          >
            <Text className="text-slate-500 text-center text-sm font-medium">
              {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión aquí'}
            </Text>
          </TouchableOpacity>

          {/* DIVISOR 'O' */}
          <View className="flex-row items-center justify-center my-2 px-8">
            <View className="flex-1 h-[1px] bg-slate-100" />
            <Text className="text-slate-400 text-xs px-3 font-normal">o</Text>
            <View className="flex-1 h-[1px] bg-slate-100" />
          </View>

          {/* BOTONES SOCIALES: Sin negrita, peso medio, sombras suaves */}
          <View className="w-full" style={{ gap: 12 }}>
            <TouchableOpacity
              className="w-full h-[52px] bg-slate-50 border border-slate-200 rounded-2xl flex-row items-center justify-center px-4"
              activeOpacity={0.8}
            >
              <Image 
                source={require('../../../../assets/google.png')} 
                style={{ width: 18, height: 18, marginRight: 10 }} 
                resizeMode="contain"
              />
              <Text className="text-slate-700 text-sm font-medium">
                Continuar con Google
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="w-full h-[52px] bg-slate-50 border border-slate-200 rounded-2xl flex-row items-center justify-center px-4"
              activeOpacity={0.8}
            >
              <Image 
                source={require('../../../../assets/apple.png')} 
                style={{ width: 18, height: 18, marginRight: 10 }} 
                resizeMode="contain"
              />
              <Text className="text-slate-700 text-sm font-medium">
                Continuar con Apple
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* BOTTOM: Legal Footer */}
        <View className="px-6 mt-8">
          <Text className="text-slate-400 text-[11px] text-center leading-4 font-normal">
            Al hacer clic en continuar, aceptas nuestros{' '}
            <Text className="text-slate-600 font-medium">Términos de servicio</Text>
            {' '}y{' '}
            <Text className="text-slate-600 font-medium">Política de privacidad</Text>
          </Text>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

