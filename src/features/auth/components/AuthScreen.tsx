import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../core/supabase';

const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa correo y contraseña');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) Alert.alert('Error', error.message);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          Alert.alert('Error', error.message);
        } else {
          Alert.alert('Registro exitoso', 'Por favor verifica tu correo si es necesario.');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12">
        {/* Título */}
        <View className="items-center mb-12">
          <Text className="text-4xl font-bold text-black">Chronos AI</Text>
        </View>

        {/* Subtítulos */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-black mb-1">
            {isLogin ? 'Inicia sesión' : 'Crea una cuenta'}
          </Text>
          <Text className="text-slate-500 text-base">
            {isLogin 
              ? 'Ingresa tu correo electrónico y contraseña para continuar' 
              : 'Regístrate para comenzar a organizar tu día'}
          </Text>
        </View>

        {/* Formulario */}
        <View className="gap-y-4 mb-6">
          <TextInput
            className="w-full h-14 border border-slate-200 rounded-xl px-4 text-base"
            placeholder="Correo electrónico"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            className="w-full h-14 border border-slate-200 rounded-xl px-4 text-base"
            placeholder="Contraseña"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* Botón Principal */}
        <TouchableOpacity
          className="w-full h-14 bg-black rounded-xl items-center justify-center mb-4"
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">
              {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Botón de Cambio */}
        <TouchableOpacity 
          className="w-full py-2 items-center mb-4" 
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text className="text-black font-medium text-sm">
            {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión aquí'}
          </Text>
        </TouchableOpacity>

        {/* Divisor */}
        <View className="flex-row items-center mb-8">
          <View className="flex-1 h-[1px] bg-slate-200" />
          <Text className="mx-4 text-slate-400 font-medium text-sm">o</Text>
          <View className="flex-1 h-[1px] bg-slate-200" />
        </View>

        {/* Botones Sociales */}
        <View className="gap-y-4">
          <TouchableOpacity className="w-full h-14 bg-slate-100 rounded-xl flex-row items-center justify-center">
            <View className="w-5 h-5 bg-slate-300 rounded-full mr-3" />
            <Text className="text-black font-semibold text-base">Continuar con Google</Text>
          </TouchableOpacity>
          <TouchableOpacity className="w-full h-14 bg-slate-100 rounded-xl flex-row items-center justify-center">
            <View className="w-5 h-5 bg-slate-300 rounded-full mr-3" />
            <Text className="text-black font-semibold text-base">Continuar con Apple</Text>
          </TouchableOpacity>
        </View>

        {/* Texto Legal */}
        <View className="mt-auto mb-6">
          <Text className="text-slate-400 text-center text-xs px-6 leading-5">
            Al hacer clic en continuar, aceptas nuestros{' '}
            <Text className="text-black font-medium">Términos de servicio</Text> y{' '}
            <Text className="text-black font-medium">Política de privacidad</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AuthScreen;
