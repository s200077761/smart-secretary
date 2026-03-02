// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Tab bar icons
  "house.fill": "home",
  "person.3.fill": "groups",
  "magnifyingglass": "search",
  "chevron.left.forwardslash.chevron.right": "code",
  "gearshape.fill": "settings",
  // Additional icons
  "paperplane.fill": "send",
  "chevron.right": "chevron-right",
  "xmark": "close",
  "plus": "add",
  "doc.text": "description",
  "calendar": "event",
  "envelope": "email",
  "chart.bar": "bar-chart",
  "brain": "psychology",
  "sparkles": "auto-awesome",
  "copy": "content-copy",
  "trash": "delete",
  "moon": "dark-mode",
  "sun.max": "light-mode",
  "globe": "language",
  "info.circle": "info",
  "arrow.clockwise": "refresh",
  "mic": "mic",
  "stop.fill": "stop",
  // Manus agent icons
  "checkmark": "check",
  "checkmark.circle.fill": "check-circle",
  "arrow.right": "arrow-forward",
  "play.fill": "play-arrow",
  "chevron.up": "keyboard-arrow-up",
  "chevron.down": "keyboard-arrow-down",
  "list.bullet": "format-list-bulleted",
  "list.bullet.clipboard": "assignment",
  "bubble.left.and.bubble.right": "chat",
  "arrow.triangle.2.circlepath": "sync",
  "checkmark.seal.fill": "verified",
  "exclamationmark.triangle": "warning",
  "checkmark.shield": "verified-user",
} satisfies Record<string, MaterialIconName>;

type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
