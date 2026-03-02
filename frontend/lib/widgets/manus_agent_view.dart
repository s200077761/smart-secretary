/// Manus Agent View — Flutter version of the Manus-AI-style UI.
/// Shows real-time step updates via SSE streaming from the FastAPI backend.

import 'dart:async';
import 'package:flutter/material.dart';
import '../models/agent.dart';
import '../services/api_service.dart';
import '../core/theme.dart';

// ── Tool metadata ─────────────────────────────────────────────────────────────

const _toolMeta = {
  'research': (icon: Icons.search, label: 'بحث', color: Color(0xFF8B5CF6)),
  'write':    (icon: Icons.edit_note, label: 'كتابة', color: Color(0xFFF59E0B)),
  'analyze':  (icon: Icons.bar_chart, label: 'تحليل', color: Color(0xFFEC4899)),
  'code':     (icon: Icons.code, label: 'كود', color: Color(0xFF10B981)),
  'plan':     (icon: Icons.list_alt, label: 'تخطيط', color: Color(0xFF3B82F6)),
  'review':   (icon: Icons.verified_outlined, label: 'مراجعة', color: Color(0xFFF97316)),
  'browse':   (icon: Icons.language, label: 'تصفح', color: Color(0xFF06B6D4)),
};

// ── Pulsing dots ──────────────────────────────────────────────────────────────

class _PulsingDots extends StatefulWidget {
  final Color color;
  const _PulsingDots({this.color = kPrimary});

  @override
  State<_PulsingDots> createState() => _PulsingDotsState();
}

class _PulsingDotsState extends State<_PulsingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (i) {
        return AnimatedBuilder(
          animation: _ctrl,
          builder: (_, __) {
            final v = ((_ctrl.value - i * 0.18) % 1.0).clamp(0.0, 1.0);
            final scale = 0.5 + 0.5 * (v < 0.5 ? v * 2 : (1 - v) * 2);
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              width: 7, height: 7 * scale,
              decoration: BoxDecoration(
                color: widget.color.withOpacity(0.8), shape: BoxShape.circle,
              ),
            );
          },
        );
      }),
    );
  }
}

// ── Step card ─────────────────────────────────────────────────────────────────

class _StepCard extends StatefulWidget {
  final ManusStep step;
  const _StepCard({required this.step});

  @override
  State<_StepCard> createState() => _StepCardState();
}

class _StepCardState extends State<_StepCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final step = widget.step;
    final cs = Theme.of(context).colorScheme;
    final meta = step.tool != null ? _toolMeta[step.tool] : null;

    Color borderColor = cs.outlineVariant;
    if (step.status == ManusStepStatus.completed) borderColor = const Color(0xFF10B981);
    if (step.status == ManusStepStatus.failed)    borderColor = cs.error;
    if (step.status == ManusStepStatus.thinking ||
        step.status == ManusStepStatus.running)   borderColor = kPrimary;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border.all(color: borderColor, width: 1.5),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          // Header row
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: step.status == ManusStepStatus.completed || step.status == ManusStepStatus.failed
                ? () => setState(() => _expanded = !_expanded)
                : null,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  // Expand arrow
                  if (step.status == ManusStepStatus.completed || step.status == ManusStepStatus.failed)
                    Icon(_expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                        size: 18, color: cs.onSurfaceVariant),

                  const Spacer(),

                  // Title + tool badge
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (meta != null)
                          Container(
                            margin: const EdgeInsets.only(bottom: 4),
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: meta.color.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(meta.label,
                                    style: TextStyle(fontSize: 11, color: meta.color,
                                        fontWeight: FontWeight.w600)),
                                const SizedBox(width: 4),
                                Icon(meta.icon, size: 12, color: meta.color),
                              ],
                            ),
                          ),
                        Text(step.title,
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                            textAlign: TextAlign.right),
                      ],
                    ),
                  ),

                  const SizedBox(width: 10),

                  // Status icon
                  _buildStatusIcon(step, cs),
                ],
              ),
            ),
          ),

          // Thinking display
          if (step.status == ManusStepStatus.thinking && step.thought != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: kPrimary.withOpacity(0.07),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('💭 أفكر في...',
                        style: TextStyle(fontSize: 12, color: kPrimary, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(step.thought!,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                        textAlign: TextAlign.right),
                  ],
                ),
              ),
            ),

          // Running: description
          if (step.status == ManusStepStatus.running)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Text(step.description,
                  style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                  textAlign: TextAlign.right),
            ),

          // Expanded: thought + actions + result
          if (_expanded) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (step.thought != null) ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: kPrimary.withOpacity(0.07),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('💭 التفكير المسبق',
                              style: TextStyle(fontSize: 12, color: kPrimary, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 4),
                          Text(step.thought!,
                              style: const TextStyle(fontSize: 12), textAlign: TextAlign.right),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (step.actions.isNotEmpty) ...[
                    Text('الإجراءات المتخذة:',
                        style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
                    const SizedBox(height: 6),
                    ...step.actions.map((a) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Flexible(child: Text(a, style: const TextStyle(fontSize: 12), textAlign: TextAlign.right)),
                          const SizedBox(width: 6),
                          Icon(Icons.arrow_back, size: 12, color: meta?.color ?? kPrimary),
                        ],
                      ),
                    )),
                    const SizedBox(height: 10),
                  ],
                  if (step.result != null) ...[
                    const Divider(),
                    const SizedBox(height: 6),
                    Text('النتيجة:', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
                    const SizedBox(height: 4),
                    Text(step.result!, style: const TextStyle(fontSize: 13, height: 1.5),
                        textAlign: TextAlign.right),
                  ],
                ],
              ),
            ),
          ],

          // Collapsed completed: result preview
          if (!_expanded && step.status == ManusStepStatus.completed && step.result != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Text(step.result!,
                  maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                  textAlign: TextAlign.right),
            ),
        ],
      ),
    );
  }

  Widget _buildStatusIcon(ManusStep step, ColorScheme cs) {
    switch (step.status) {
      case ManusStepStatus.thinking:
        return const _PulsingDots();
      case ManusStepStatus.running:
        return const SizedBox.square(dimension: 20,
            child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary));
      case ManusStepStatus.completed:
        return const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 22);
      case ManusStepStatus.failed:
        return Icon(Icons.cancel, color: cs.error, size: 22);
      default:
        return Container(
          width: 22, height: 22,
          decoration: BoxDecoration(shape: BoxShape.circle,
              border: Border.all(color: cs.outlineVariant, width: 1.5)),
          child: Center(child: Text('${step.id}',
              style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant))),
        );
    }
  }
}

// ── Main view ─────────────────────────────────────────────────────────────────

class ManusAgentView extends StatefulWidget {
  const ManusAgentView({super.key});

  @override
  State<ManusAgentView> createState() => _ManusAgentViewState();
}

class _ManusAgentViewState extends State<ManusAgentView> {
  final _api = ApiService();
  final _scrollCtrl = ScrollController();
  final _inputCtrl = TextEditingController();

  ManusTaskState _state = const ManusTaskState(status: 'idle');
  StreamSubscription<ManusTaskState>? _sub;

  @override
  void dispose() {
    _sub?.cancel();
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _start() async {
    final task = _inputCtrl.text.trim();
    if (task.isEmpty || _state.isRunning) return;

    setState(() => _state = const ManusTaskState(status: 'planning'));
    _scrollToBottom();

    _sub = _api.runAgentStream(task).listen(
      (s) { setState(() => _state = s); _scrollToBottom(); },
      onError: (e) => setState(() => _state = ManusTaskState(
          status: 'failed', error: e.toString())),
    );
  }

  void _reset() {
    _sub?.cancel();
    setState(() {
      _state = const ManusTaskState(status: 'idle');
      _inputCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    final statusLabel = switch (_state.status) {
      'planning'   => '📋 جاري التخطيط...',
      'executing'  => '⚙️ تنفيذ الخطوة ${_state.currentStepIndex + 1}/${_state.steps.length}',
      'reflecting' => '🔍 جاري مراجعة النتائج...',
      'completed'  => '✅ اكتملت المهمة',
      'failed'     => '❌ فشل التنفيذ',
      _            => '',
    };

    final done = _state.steps.where((s) => s.status == ManusStepStatus.completed || s.status == ManusStepStatus.failed).length;
    final total = _state.steps.length;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      maxChildSize: 1.0,
      builder: (_, __) => Column(
        children: [
          // Handle bar
          Center(
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: cs.outlineVariant, borderRadius: BorderRadius.circular(2)),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                if (_state.isDone)
                  IconButton(icon: const Icon(Icons.refresh), onPressed: _reset),
                const Spacer(),
                const Icon(Icons.memory_outlined, color: kPrimary),
                const SizedBox(width: 8),
                const Text('وكيل مانوس',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                if (_state.isRunning) ...[
                  const SizedBox(width: 8),
                  const _PulsingDots(),
                ],
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () { _sub?.cancel(); Navigator.pop(context); },
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              controller: _scrollCtrl,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              children: [
                // Idle: intro + input
                if (_state.status == 'idle') ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cs.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: const [
                        Text('وكيل مانوس المستقل',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        SizedBox(height: 8),
                        Text(
                          'يُخطط المهمة، يُفكّر في كل خطوة، ينفذها بالأداة المناسبة، ثم يتأمل النتائج.',
                          textAlign: TextAlign.right,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _inputCtrl,
                    maxLines: 4,
                    textAlign: TextAlign.right,
                    textDirection: TextDirection.rtl,
                    decoration: const InputDecoration(
                      hintText: 'اكتب المهمة التي تريد تنفيذها...',
                      hintTextDirection: TextDirection.rtl,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _start,
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: const Text('ابدأ التنفيذ المستقل'),
                  ),
                ],

                // Status banner
                if (_state.status != 'idle') ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: _state.status == 'completed'
                          ? const Color(0xFFD1FAE5)
                          : _state.status == 'failed'
                              ? const Color(0xFFFEE2E2)
                              : cs.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _state.status == 'completed'
                            ? const Color(0xFF6EE7B7)
                            : _state.status == 'failed'
                                ? const Color(0xFFFCA5A5)
                                : kPrimary.withOpacity(0.5),
                      ),
                    ),
                    child: Row(
                      children: [
                        const SizedBox(width: 10),
                        if (_state.isRunning)
                          const SizedBox.square(dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary)),
                        const Spacer(),
                        Flexible(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(statusLabel,
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                                  textAlign: TextAlign.right),
                              if (_state.currentThought != null)
                                Text(_state.currentThought!,
                                    style: const TextStyle(fontSize: 12, color: kPrimary),
                                    textAlign: TextAlign.right, maxLines: 2),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Progress bar
                  if (total > 0) ...[
                    Row(
                      children: [
                        Text('$done / $total خطوة',
                            style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: LinearProgressIndicator(
                              value: done / total,
                              backgroundColor: cs.outlineVariant,
                              color: kPrimary,
                              minHeight: 6,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Step cards
                  if (_state.steps.isNotEmpty) ...[
                    const Text('خطوات التنفيذ:',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                        textAlign: TextAlign.right),
                    const SizedBox(height: 8),
                    ..._state.steps.map((s) => _StepCard(step: s)),
                  ],

                  // Reflection note
                  if (_state.reflectionNote != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: kPrimary.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: kPrimary.withOpacity(0.25)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Text('تقييم النتائج',
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kPrimary)),
                              SizedBox(width: 6),
                              Icon(Icons.auto_awesome, size: 16, color: kPrimary),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(_state.reflectionNote!,
                              style: const TextStyle(fontSize: 13, height: 1.5),
                              textAlign: TextAlign.right),
                        ],
                      ),
                    ),
                  ],

                  // Final result
                  if (_state.finalResult != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: cs.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: kPrimary, width: 2),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Text('النتيجة النهائية',
                                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: kPrimary)),
                              SizedBox(width: 8),
                              Icon(Icons.check_circle, color: kPrimary, size: 22),
                            ],
                          ),
                          const Divider(),
                          Text(_state.finalResult!,
                              style: const TextStyle(fontSize: 14, height: 1.6),
                              textAlign: TextAlign.right),
                        ],
                      ),
                    ),
                  ],

                  // Error
                  if (_state.status == 'failed' && _state.error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Row(
                        children: [
                          Flexible(
                            child: Text(_state.error!,
                                style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13),
                                textAlign: TextAlign.right),
                          ),
                          const SizedBox(width: 10),
                          const Icon(Icons.error_outline, color: Color(0xFFDC2626)),
                        ],
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
