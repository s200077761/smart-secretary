/**
 * ManusAgentView – Manus-AI-style autonomous agent UI
 *
 * Phases shown:
 *  planning  → animated brain icon + "جاري التخطيط"
 *  thinking  → pulsing dots + live thought text per step
 *  running   → tool icon + spinner
 *  reflecting → mirror icon + "جاري التأمل"
 *  completed → final result with reflection note
 *  failed    → error card
 */

import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { ManusStep, ManusTaskState, ManusToolType } from "@/lib/types";
import { runManusAgent } from "@/lib/manus-agent";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ---------------------------------------------------------------------------
// Tool metadata
// ---------------------------------------------------------------------------
const TOOL_META: Record<ManusToolType, { icon: string; label: string; color: string }> = {
  research: { icon: "magnifyingglass", label: "بحث", color: "#8B5CF6" },
  write: { icon: "doc.text", label: "كتابة", color: "#F59E0B" },
  analyze: { icon: "chart.bar", label: "تحليل", color: "#EC4899" },
  code: { icon: "chevron.left.forwardslash.chevron.right", label: "كود", color: "#10B981" },
  plan: { icon: "list.bullet", label: "تخطيط", color: "#3B82F6" },
  review: { icon: "checkmark.shield", label: "مراجعة", color: "#F97316" },
  browse: { icon: "globe", label: "تصفح", color: "#06B6D4" },
};

// ---------------------------------------------------------------------------
// Pulsing dot animation
// ---------------------------------------------------------------------------
function PulsingDots({ color }: { color: string }) {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.dotsRow}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, { backgroundColor: color, opacity: dot }]} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step status indicator
// ---------------------------------------------------------------------------
function StepIcon({ step, colors }: { step: ManusStep; colors: ReturnType<typeof useColors> }) {
  const tool = step.tool ? TOOL_META[step.tool] : null;

  if (step.status === "thinking") {
    return <PulsingDots color="#0EA5E9" />;
  }
  if (step.status === "running") {
    return <ActivityIndicator size="small" color={tool?.color ?? colors.primary} />;
  }
  if (step.status === "completed") {
    return <IconSymbol name="checkmark.circle.fill" size={22} color="#10B981" />;
  }
  if (step.status === "failed") {
    return <IconSymbol name="xmark.circle.fill" size={22} color="#EF4444" />;
  }
  // pending
  return (
    <View style={[styles.pendingDot, { borderColor: colors.muted }]}>
      <Text style={[styles.pendingNum, { color: colors.muted }]}>{step.id}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single step card
// ---------------------------------------------------------------------------
function StepCard({ step, colors }: { step: ManusStep; colors: ReturnType<typeof useColors> }) {
  const [expanded, setExpanded] = useState(false);
  const isFinished = step.status === "completed" || step.status === "failed";
  const tool = step.tool ? TOOL_META[step.tool] : null;
  const isActive = step.status === "thinking" || step.status === "running";

  const borderColor =
    step.status === "completed"
      ? "#10B981"
      : step.status === "failed"
      ? "#EF4444"
      : isActive
      ? "#0EA5E9"
      : colors.border;

  return (
    <View style={[styles.stepCard, { backgroundColor: colors.surface, borderColor }]}>
      {/* Step header row */}
      <Pressable
        onPress={() => isFinished && setExpanded((v) => !v)}
        style={styles.stepHeader}
      >
        <StepIcon step={step} colors={colors} />

        <View style={styles.stepTitleWrap}>
          {tool && (
            <View style={[styles.toolBadge, { backgroundColor: tool.color + "20" }]}>
              <IconSymbol name={tool.icon as any} size={11} color={tool.color} />
              <Text style={[styles.toolLabel, { color: tool.color }]}>{tool.label}</Text>
            </View>
          )}
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

      {/* Thinking display */}
      {step.status === "thinking" && step.thought && (
        <View style={styles.thoughtBox}>
          <Text style={[styles.thoughtLabel, { color: "#0EA5E9" }]}>💭 أفكر في...</Text>
          <Text style={[styles.thoughtText, { color: colors.muted }]}>{step.thought}</Text>
        </View>
      )}

      {/* Running: show description */}
      {step.status === "running" && (
        <Text style={[styles.stepDescription, { color: colors.muted }]}>{step.description}</Text>
      )}

      {/* Expanded: actions + result */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Thought */}
          {step.thought && (
            <View style={[styles.thoughtBox, { backgroundColor: "#0EA5E920" }]}>
              <Text style={[styles.thoughtLabel, { color: "#0EA5E9" }]}>💭 التفكير المسبق</Text>
              <Text style={[styles.thoughtText, { color: colors.foreground }]}>{step.thought}</Text>
            </View>
          )}

          {/* Actions */}
          {step.actions && step.actions.length > 0 && (
            <View style={styles.actionsBox}>
              <Text style={[styles.actionsLabel, { color: colors.muted }]}>الإجراءات المتخذة:</Text>
              {step.actions.map((action, i) => (
                <View key={i} style={styles.actionRow}>
                  <IconSymbol name="arrow.right" size={12} color={tool?.color ?? colors.primary} />
                  <Text style={[styles.actionText, { color: colors.foreground }]}>{action}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Result */}
          {step.result && (
            <View style={[styles.resultBox, { borderTopColor: colors.border }]}>
              <Text style={[styles.resultLabel, { color: colors.muted }]}>النتيجة:</Text>
              <Text style={[styles.stepResult, { color: colors.foreground }]}>{step.result}</Text>
            </View>
          )}
        </View>
      )}

      {/* Completed: preview result */}
      {step.status === "completed" && !expanded && step.result && (
        <Text style={[styles.resultPreview, { color: colors.muted }]} numberOfLines={2}>
          {step.result}
        </Text>
      )}

      {/* Failed: show error */}
      {step.status === "failed" && step.result && (
        <Text style={[styles.errorText, { color: "#EF4444" }]}>{step.result}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Overall progress bar
// ---------------------------------------------------------------------------
function ProgressBar({ steps, colors }: { steps: ManusStep[]; colors: ReturnType<typeof useColors> }) {
  if (steps.length === 0) return null;
  const done = steps.filter((s) => s.status === "completed" || s.status === "failed").length;
  const pct = (done / steps.length) * 100;

  return (
    <View style={[styles.progressContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: "#0EA5E9" }]} />
      </View>
      <Text style={[styles.progressLabel, { color: colors.muted }]}>
        {done} / {steps.length} خطوة
      </Text>
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

  const isRunning =
    taskState.status === "planning" ||
    taskState.status === "executing" ||
    taskState.status === "reflecting";
  const isDone = taskState.status === "completed" || taskState.status === "failed";

  const statusLabel: Record<ManusTaskState["status"], string> = {
    idle: "",
    planning: "جاري تخطيط المهمة وتحديد الخطوات...",
    executing: `تنفيذ الخطوة ${taskState.currentStepIndex + 1} من ${taskState.steps.length}`,
    reflecting: "جاري مراجعة وتقييم نتائج العمل...",
    completed: "اكتملت المهمة بنجاح",
    failed: "فشل التنفيذ",
  };

  const statusIcon: Record<ManusTaskState["status"], string> = {
    idle: "",
    planning: "list.bullet.clipboard",
    executing: "cpu",
    reflecting: "arrow.triangle.2.circlepath",
    completed: "checkmark.seal.fill",
    failed: "xmark.circle.fill",
  };

  const handleStart = async () => {
    if (!taskInput.trim() || isRunning) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    await runManusAgent(taskInput.trim(), (newState) => {
      setTaskState(newState);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
  };

  const handleReset = () => {
    setTaskInput("");
    setTaskState({ status: "idle", steps: [], currentStepIndex: 0 });
  };

  const currentStep = taskState.steps[taskState.currentStepIndex];
  const currentTool = currentStep?.tool ? TOOL_META[currentStep.tool] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} style={styles.headerBtn}>
          <IconSymbol name="xmark" size={22} color={colors.muted} />
        </Pressable>
        <View style={styles.headerCenter}>
          <IconSymbol name="cpu" size={20} color="#0EA5E9" />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>وكيل مانوس</Text>
          {isRunning && <PulsingDots color="#0EA5E9" />}
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
        {/* ── Idle: info card + input ── */}
        {taskState.status === "idle" && (
          <>
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>وكيل مانوس المستقل</Text>
              <Text style={[styles.infoText, { color: colors.muted }]}>
                يُخطط المهمة، ثم يُفكّر في كل خطوة، يُنفّذها باستخدام الأداة المناسبة،
                ثم يتأمل النتائج ويُقدّم ملخصاً شاملاً.
              </Text>
              <View style={styles.capabilityList}>
                {[
                  { icon: "list.bullet.clipboard", label: "تخطيط ذكي للمهام" },
                  { icon: "bubble.left.and.bubble.right", label: "تفكير قبل كل خطوة" },
                  { icon: "cpu", label: "تنفيذ متعدد الأدوات" },
                  { icon: "arrow.triangle.2.circlepath", label: "مراجعة وتقييم النتائج" },
                ].map(({ icon, label }) => (
                  <View key={label} style={styles.capabilityItem}>
                    <IconSymbol name={icon as any} size={16} color="#0EA5E9" />
                    <Text style={[styles.capabilityText, { color: colors.foreground }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              اكتب المهمة التي تريد تنفيذها:
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
              placeholder="مثال: أعدّ لي تقريراً شاملاً عن أفضل ممارسات تطوير تطبيقات الجوال..."
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
                !taskInput.trim() && { opacity: 0.4 },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="play.fill" size={16} color="#fff" />
              <Text style={styles.startBtnText}>ابدأ التنفيذ المستقل</Text>
            </Pressable>
          </>
        )}

        {/* ── Status banner ── */}
        {(isRunning || isDone) && taskState.status !== "idle" && (
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
                    : "#0EA5E9",
              },
            ]}
          >
            {isRunning ? (
              <ActivityIndicator size="small" color="#0EA5E9" />
            ) : (
              <IconSymbol
                name={statusIcon[taskState.status] as any}
                size={18}
                color={taskState.status === "completed" ? "#059669" : "#DC2626"}
              />
            )}
            <View style={styles.statusTextWrap}>
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
              {/* Live current thought */}
              {taskState.currentThought && (
                <Text style={[styles.liveThought, { color: "#0EA5E9" }]} numberOfLines={2}>
                  {taskState.currentThought}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Current tool indicator ── */}
        {taskState.status === "executing" && currentTool && (
          <View style={[styles.toolIndicator, { backgroundColor: currentTool.color + "15", borderColor: currentTool.color + "40" }]}>
            <IconSymbol name={currentTool.icon as any} size={16} color={currentTool.color} />
            <Text style={[styles.toolIndicatorText, { color: currentTool.color }]}>
              الأداة المستخدمة: {currentTool.label}
            </Text>
          </View>
        )}

        {/* ── Progress bar ── */}
        {taskState.steps.length > 0 && taskState.status !== "idle" && (
          <ProgressBar steps={taskState.steps} colors={colors} />
        )}

        {/* ── Step list ── */}
        {taskState.steps.length > 0 && (
          <View style={styles.stepList}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>خطوات التنفيذ:</Text>
            {taskState.steps.map((step) => (
              <StepCard key={step.id} step={step} colors={colors} />
            ))}
          </View>
        )}

        {/* ── Reflection note ── */}
        {(taskState.status === "completed" || taskState.status === "reflecting") &&
          taskState.reflectionNote && (
            <View style={[styles.reflectionCard, { backgroundColor: colors.surface, borderColor: "#0EA5E940" }]}>
              <View style={styles.reflectionHeader}>
                <IconSymbol name="arrow.triangle.2.circlepath" size={16} color="#0EA5E9" />
                <Text style={[styles.reflectionTitle, { color: "#0EA5E9" }]}>تقييم النتائج</Text>
              </View>
              <Text style={[styles.reflectionText, { color: colors.foreground }]}>
                {taskState.reflectionNote}
              </Text>
            </View>
          )}

        {/* ── Final result ── */}
        {taskState.status === "completed" && taskState.finalResult && (
          <View style={[styles.finalCard, { backgroundColor: colors.surface, borderColor: "#0EA5E9" }]}>
            <View style={styles.finalHeader}>
              <IconSymbol name="checkmark.seal.fill" size={22} color="#0EA5E9" />
              <Text style={[styles.finalTitle, { color: "#0EA5E9" }]}>النتيجة النهائية</Text>
            </View>
            <Text style={[styles.finalText, { color: colors.foreground }]}>
              {taskState.finalResult}
            </Text>
          </View>
        )}

        {/* ── Error ── */}
        {taskState.status === "failed" && taskState.error && (
          <View style={[styles.errorCard, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
            <IconSymbol name="exclamationmark.triangle" size={20} color="#DC2626" />
            <Text style={[styles.errorCardText, { color: "#DC2626" }]}>{taskState.error}</Text>
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
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "600" },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  // Info card
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 12 },
  infoTitle: { fontSize: 17, fontWeight: "700", textAlign: "right" },
  infoText: { fontSize: 14, lineHeight: 22, textAlign: "right" },
  capabilityList: { gap: 10, marginTop: 4 },
  capabilityItem: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  capabilityText: { fontSize: 14 },

  // Input
  sectionLabel: { fontSize: 15, fontWeight: "600", textAlign: "right" },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, minHeight: 110 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 12,
  },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Status banner
  statusBanner: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusTextWrap: { flex: 1, gap: 4, alignItems: "flex-end" },
  statusText: { fontSize: 14, fontWeight: "600", textAlign: "right" },
  liveThought: { fontSize: 12, textAlign: "right", fontStyle: "italic" },

  // Tool indicator
  toolIndicator: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolIndicatorText: { fontSize: 13, fontWeight: "500" },

  // Progress bar
  progressContainer: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { fontSize: 12, textAlign: "right" },

  // Step list
  stepList: { gap: 10 },

  // Step card
  stepCard: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 8 },
  stepHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  stepTitleWrap: { flex: 1, alignItems: "flex-end", gap: 4 },
  toolBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  toolLabel: { fontSize: 10, fontWeight: "600" },
  stepTitle: { fontSize: 14, fontWeight: "600", textAlign: "right" },
  stepDescription: { fontSize: 13, lineHeight: 20, textAlign: "right" },

  // Thinking
  thoughtBox: {
    borderRadius: 8,
    padding: 10,
    gap: 4,
    backgroundColor: "#0EA5E910",
  },
  thoughtLabel: { fontSize: 12, fontWeight: "600" },
  thoughtText: { fontSize: 12, lineHeight: 18, textAlign: "right" },

  // Expanded content
  expandedContent: { gap: 10, marginTop: 4 },
  actionsBox: { gap: 6 },
  actionsLabel: { fontSize: 12, fontWeight: "500", textAlign: "right" },
  actionRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 6 },
  actionText: { fontSize: 13, flex: 1, textAlign: "right" },
  resultBox: { borderTopWidth: 0.5, paddingTop: 10, gap: 4 },
  resultLabel: { fontSize: 12, fontWeight: "500", textAlign: "right" },
  stepResult: { fontSize: 13, lineHeight: 20, textAlign: "right" },
  resultPreview: { fontSize: 12, lineHeight: 18, textAlign: "right" },
  errorText: { fontSize: 13, textAlign: "right" },

  // Pending dot
  pendingDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingNum: { fontSize: 11, fontWeight: "700" },

  // Pulsing dots
  dotsRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 3.5 },

  // Reflection card
  reflectionCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  reflectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  reflectionTitle: { fontSize: 14, fontWeight: "600" },
  reflectionText: { fontSize: 13, lineHeight: 20, textAlign: "right" },

  // Final result card
  finalCard: { borderRadius: 16, borderWidth: 2, padding: 18, gap: 14 },
  finalHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  finalTitle: { fontSize: 17, fontWeight: "700" },
  finalText: { fontSize: 14, lineHeight: 24, textAlign: "right" },

  // Error card
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
  },
  errorCardText: { fontSize: 14, flex: 1, textAlign: "right" },
});
