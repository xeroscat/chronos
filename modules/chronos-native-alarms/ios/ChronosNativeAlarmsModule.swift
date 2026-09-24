import ExpoModulesCore

public class ChronosNativeAlarmsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ChronosNativeAlarms")

    AsyncFunction("setValueAsync") { (value: String) in
    }
  }
}
