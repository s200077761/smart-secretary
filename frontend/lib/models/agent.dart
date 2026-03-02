import 'package:flutter/material.dart';

class Agent {
  final String id;
  final String nameAr;
  final String descriptionAr;
  final IconData icon;
  final Color color;
  final bool isManus;

  const Agent({
    required this.id,
    required this.nameAr,
    required this.descriptionAr,
    required this.icon,
    required this.color,
    this.isManus = false,
  });
}

final List<Agent> kAgents = [
  const Agent(
    id: 'email',
    nameAr: 'مساعد البريد',
    descriptionAr: 'كتابة رسائل بريد إلكتروني احترافية',
    icon: Icons.email_outlined,
    color: Color(0xFF3B82F6),
  ),
  const Agent(
    id: 'calendar',
    nameAr: 'منظم المواعيد',
    descriptionAr: 'تنظيم وجدولة المواعيد والأحداث',
    icon: Icons.calendar_today_outlined,
    color: Color(0xFF10B981),
  ),
  const Agent(
    id: 'notes',
    nameAr: 'كاتب الملاحظات',
    descriptionAr: 'إنشاء وتنظيم الملاحظات',
    icon: Icons.note_outlined,
    color: Color(0xFFF59E0B),
  ),
  const Agent(
    id: 'research',
    nameAr: 'باحث المعلومات',
    descriptionAr: 'بحث معمق في أي موضوع',
    icon: Icons.search_outlined,
    color: Color(0xFF8B5CF6),
  ),
  const Agent(
    id: 'data',
    nameAr: 'محلل البيانات',
    descriptionAr: 'تحليل البيانات وتقديم رؤى',
    icon: Icons.bar_chart_outlined,
    color: Color(0xFFEC4899),
  ),
  const Agent(
    id: 'custom',
    nameAr: 'وكيل مخصص',
    descriptionAr: 'إنشاء سير عمل مخصص',
    icon: Icons.auto_awesome_outlined,
    color: Color(0xFF6366F1),
  ),
  const Agent(
    id: 'manus',
    nameAr: 'وكيل مانوس',
    descriptionAr: 'تنفيذ المهام المعقدة خطوة بخطوة',
    icon: Icons.memory_outlined,
    color: Color(0xFF0EA5E9),
    isManus: true,
  ),
];

// Manus agent step types
enum ManusStepStatus { pending, thinking, running, completed, failed }

class ManusStep {
  final int id;
  final String title;
  final String description;
  final ManusStepStatus status;
  final String? thought;
  final String? tool;
  final List<String> actions;
  final String? result;

  const ManusStep({
    required this.id,
    required this.title,
    required this.description,
    this.status = ManusStepStatus.pending,
    this.thought,
    this.tool,
    this.actions = const [],
    this.result,
  });

  factory ManusStep.fromJson(Map<String, dynamic> json) => ManusStep(
        id: json['id'] as int,
        title: json['title'] as String,
        description: json['description'] as String,
        status: _statusFromString(json['status'] as String? ?? 'pending'),
        thought: json['thought'] as String?,
        tool: json['tool'] as String?,
        actions: (json['actions'] as List<dynamic>?)?.cast<String>() ?? [],
        result: json['result'] as String?,
      );

  static ManusStepStatus _statusFromString(String s) => switch (s) {
        'thinking' => ManusStepStatus.thinking,
        'running' => ManusStepStatus.running,
        'completed' => ManusStepStatus.completed,
        'failed' => ManusStepStatus.failed,
        _ => ManusStepStatus.pending,
      };
}

class ManusTaskState {
  final String status; // planning | executing | reflecting | completed | failed
  final List<ManusStep> steps;
  final int currentStepIndex;
  final String? currentThought;
  final String? finalResult;
  final String? reflectionNote;
  final String? error;

  const ManusTaskState({
    required this.status,
    this.steps = const [],
    this.currentStepIndex = 0,
    this.currentThought,
    this.finalResult,
    this.reflectionNote,
    this.error,
  });

  factory ManusTaskState.fromJson(Map<String, dynamic> json) => ManusTaskState(
        status: json['status'] as String,
        steps: (json['steps'] as List<dynamic>?)
                ?.map((e) => ManusStep.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        currentStepIndex: json['current_step_index'] as int? ?? 0,
        currentThought: json['current_thought'] as String?,
        finalResult: json['final_result'] as String?,
        reflectionNote: json['reflection_note'] as String?,
        error: json['error'] as String?,
      );

  bool get isRunning => ['planning', 'executing', 'reflecting'].contains(status);
  bool get isDone => status == 'completed' || status == 'failed';
}
