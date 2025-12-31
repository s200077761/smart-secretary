import { View, TextInput, Pressable, StyleSheet, Platform } from "react-native";
import { useState } from "react";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const colors = useColors();
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim() && !disabled) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onSend(message.trim());
      setMessage("");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          placeholder="اكتب رسالتك..."
          placeholderTextColor={colors.muted}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={2000}
          editable={!disabled}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          textAlign="right"
        />
        <Pressable
          onPress={handleSend}
          disabled={!message.trim() || disabled}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: colors.primary },
            (!message.trim() || disabled) && { opacity: 0.5 },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
