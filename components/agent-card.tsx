import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Agent } from "@/lib/types";
import * as Haptics from "expo-haptics";

interface AgentCardProps {
  agent: Agent;
  onPress: () => void;
}

const ICON_MAP: Record<string, "envelope" | "calendar" | "doc.text" | "magnifyingglass" | "chart.bar" | "sparkles"> = {
  envelope: "envelope",
  calendar: "calendar",
  "doc.text": "doc.text",
  magnifyingglass: "magnifyingglass",
  "chart.bar": "chart.bar",
  sparkles: "sparkles",
};

export function AgentCard({ agent, onPress }: AgentCardProps) {
  const colors = useColors();

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const iconName = ICON_MAP[agent.icon] || "sparkles";

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: agent.color + "20" }]}>
        <IconSymbol name={iconName} size={28} color={agent.color} />
      </View>
      <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
        {agent.nameAr}
      </Text>
      <Text style={[styles.description, { color: colors.muted }]} numberOfLines={2}>
        {agent.descriptionAr}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 140,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "right",
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right",
  },
});
