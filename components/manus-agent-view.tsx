/**
 * ManusAgentView – UI for the autonomous Manus-style agent.
 *
 * Shows:
 *  - A task input field (when idle)
 *  - Planning / executing status header
 *  - A live step list with status icons and results
 *  - A final synthesised answer
 */

import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { ManusStep, ManusTaskState } from "@/lib/types";
import { runManusAgent } from "@/lib/manus-agent";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ---------------------------------------------------------------------------
// Step status indicator
// ---------------------------------------------------------------------------
function StepStatusIcon({ step, colors }: { step: ManusStep; colors: ReturnType<typeof useColors> }) {
  switch (step.status) {
    case "running":
      return <ActivityIndicator size="small" color={colors.primary} />;
    case "completed":
      return <IconSymbol name="checkmark.circle.fill" size={20} color="#10B981" />;
    case "failed":
      return <IconSymbol name="xmark.circle.fill" size={20} color="#EF4444" />;
    default:
      return <IconSymbol name="circle" size={20} color={colors.muted} />;
  }
}

// ---------------------------------------------------------------------------
// Single step card
// ---------------------------------------------------------------------------
function StepCard({ step, colors }: { step: ManusStep; colors: ReturnType<typeof useColors> }) {
  const [expanded, setExpanded] = useState(false);
  const isFinished = step.status === "completed" || step.status === "failed";

  return (
    <View style={[styles.stepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable onPress={() => isFinished && setExpanded((v) => !v)} style={styles.stepHeader}>
        <StepStatusIcon step={step} colors={colors} />
        <View style={styles.stepTitleWrap}>
          <Text style={[styles.stepIndex, { color: colors.muted }]}>الخطوة {step.id}</Text>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>{step.title}</Text>
        </View>
        {isFinished && (
          <IconSymbol
            name={expanded ? "chevron.up" : "chevron.down"}
            size={16}
            color={colors.muted}
          />
        )}
      </Pressable>

      {step.status === "running" && (
        <Text style={[styles.stepDescription, { color: colors.muted }]}>{step.description}</Text>
      )}

      {expanded && step.result && (
        <Text style={[styles.stepResult, { color: colors.foreground }]}>{step.result}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface ManusAgentViewProps {
  onClose: () => void;
}

export function ManusAgentView({ onClose }: ManusAgentViewProps) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);

  const [taskInput, setTaskInput] = useState("");
  const [taskState, setTaskState] = useState<ManusTaskState>({
    status: "idle",
    steps: [],
    currentStepIndex: 0,
  });

  const isRunning = taskState.status === "planning" || taskState.status === "executing";
  const isDone = taskState.status === "completed" || taskState.status === "failed";

  const statusLabel: Record<ManusTaskState["status"], string> = {
    idle: "",
    planning: "جاري تخطيط المهمة...",
    executing: `تنفيذ الخطوة ${taskState.currentStepIndex + 1} من ${taskState.steps.length}`,
    completed: "اكتملت المهمة",
    failed: "فشل التنفيذ",
  };

  const handleStart = async () => {
    if (!taskInput.trim() || isRunning) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    await runManusAgent(taskInput.trim(), (newState) => {
      setTaskState(newState);
      // Scroll to bottom as steps arrive
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
  };

  const handleReset = () => {
    setTaskInput("");
    setTaskState({ status: "idle", steps: [], currentStepIndex: 0 });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} style={styles.headerBtn}>
          <IconSymbol name="xmark" size={22} color={colors.muted} />
        </Pressable>
        <View style={styles.headerCenter}>
          <IconSymbol name="cpu" size={20} color="#0EA5E9" />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>وكيل مانوس</Text>
        </View>
        {isDone ? (
          <Pressable onPress={handleReset} style={styles.headerBtn}>
            <IconSymbol name="arrow.counterclockwise" size={20} color={colors.muted} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Description card */}
        {taskState.status === "idle" && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>ما هو وكيل مانوس؟</Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              وكيل ذكاء اصطناعي مستقل يُخطط لمهمتك، ويُقسّمها إلى خطوات، ثم يُنفّذ كل خطوة
              بشكل تلقائي ويُقدّم نتيجة شاملة في النهاية.
            </Text>
            <View style={styles.capabilityList}>
              {[
                "تخطيط المهام المعقدة",
                "التنفيذ خطوة بخطوة",
                "عرض التقدم في الوقت الفعلي",
                "تلخيص النتائج",
              ].map((cap) => (
                <View key={cap} style={styles.capabilityItem}>
                  <IconSymbol name="checkmark.circle" size={16} color="#0EA5E9" />
                  <Text style={[styles.capabilityText, { color: colors.foreground }]}>{cap}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Task input */}
        {taskState.status === "idle" && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              اكتب المهمة التي تريد تنفيذها:
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              placeholder="مثال: ابحث عن أفضل ممارسات تطوير تطبيقات الجوال وقدّم تقريراً شاملاً..."
              placeholderTextColor={colors.muted}
              value={taskInput}
              onChangeText={setTaskInput}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              textAlign="right"
            />
            <Pressable
              onPress={handleStart}
              disabled={!taskInput.trim()}
              style={({ pressed }) => [
                styles.startBtn,
                { backgroundColor: "#0EA5E9" },
                !taskInput.trim() && { opacity: 0.5 },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="play.fill" size={16} color="#fff" />
              <Text style={styles.startBtnText}>ابدأ التنفيذ</Text>
            </Pressable>
          </>
        )}

        {/* Status banner */}
        {(isRunning || isDone) && (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor:
                  taskState.status === "failed"
                    ? "#FEE2E2"
                    : taskState.status === "completed"
                    ? "#D1FAE5"
                    : colors.surface,
                borderColor:
                  taskState.status === "failed"
                    ? "#FCA5A5"
                    : taskState.status === "completed"
                    ? "#6EE7B7"
                    : colors.border,
              },
            ]}
          >
            {isRunning && <ActivityIndicator size="small" color="#0EA5E9" style={{ marginLeft: 8 }} />}
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    taskState.status === "failed"
                      ? "#DC2626"
                      : taskState.status === "completed"
                      ? "#059669"
                      : colors.foreground,
                },
              ]}
            >
              {statusLabel[taskState.status]}
            </Text>
          </View>
        )}

        {/* Step list */}
        {taskState.steps.length > 0 && (
          <View style={styles.stepList}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>خطوات التنفيذ:</Text>
            {taskState.steps.map((step) => (
              <StepCard key={step.id} step={step} colors={colors} />
            ))}
          </View>
        )}

        {/* Final result */}
        {taskState.status === "completed" && taskState.finalResult && (
          <View style={[styles.finalCard, { backgroundColor: colors.surface, borderColor: "#0EA5E9" }]}>
            <View style={styles.finalHeader}>
              <IconSymbol name="checkmark.seal.fill" size={20} color="#0EA5E9" />
              <Text style={[styles.finalTitle, { color: "#0EA5E9" }]}>النتيجة النهائية</Text>
            </View>
            <Text style={[styles.finalText, { color: colors.foreground }]}>
              {taskState.finalResult}
            </Text>
          </View>
        )}

        {/* Error */}
        {taskState.status === "failed" && taskState.error && (
          <View style={[styles.errorCard, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
            <Text style={styles.errorText}>{taskState.error}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },
  capabilityList: {
    gap: 8,
    marginTop: 4,
  },
  capabilityItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  capabilityText: {
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 110,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  statusBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  stepList: {
    gap: 10,
  },
  stepCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  stepHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  stepTitleWrap: {
    flex: 1,
    alignItems: "flex-end",
  },
  stepIndex: {
    fontSize: 11,
    fontWeight: "500",
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  stepResult: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
    marginTop: 4,
  },
  finalCard: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    gap: 12,
  },
  finalHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  finalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  finalText: {
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "right",
  },
});
