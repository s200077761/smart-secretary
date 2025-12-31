import { View, Text, StyleSheet } from "react-native";
import { ChatMessage } from "@/lib/types";
import { useColors } from "@/hooks/use-colors";
import Animated, { FadeInUp } from "react-native-reanimated";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const colors = useColors();
  const isUser = message.role === "user";

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("ar-SA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.surface },
        ]}
      >
        {message.isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingDot, { color: colors.muted }]}>●</Text>
            <Text style={[styles.loadingDot, { color: colors.muted }]}>●</Text>
            <Text style={[styles.loadingDot, { color: colors.muted }]}>●</Text>
          </View>
        ) : (
          <Text
            style={[
              styles.messageText,
              isUser
                ? { color: "#FFFFFF" }
                : { color: colors.foreground },
            ]}
          >
            {message.content}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.timestamp,
          { color: colors.muted },
          isUser ? styles.userTimestamp : styles.assistantTimestamp,
        ]}
      >
        {formatTime(message.timestamp)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: "80%",
  },
  userContainer: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 60,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "right",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  userTimestamp: {
    marginRight: 4,
  },
  assistantTimestamp: {
    marginLeft: 4,
  },
  loadingContainer: {
    flexDirection: "row",
    gap: 4,
  },
  loadingDot: {
    fontSize: 12,
  },
});
