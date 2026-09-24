import { registerWebModule, NativeModule } from 'expo';

// ChronosNativeAlarmsModule is not available on the web platform.
class ChronosNativeAlarmsModule extends NativeModule<{}> {}

export default registerWebModule(ChronosNativeAlarmsModule, 'ChronosNativeAlarmsModule');
