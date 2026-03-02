class Message {
  final String id;
  final String role; // 'user' | 'assistant'
  final String content;
  final DateTime timestamp;
  final String? agentId;

  const Message({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
    this.agentId,
  });

  factory Message.fromJson(Map<String, dynamic> json) => Message(
        id: json['id'] as String,
        role: json['role'] as String,
        content: json['content'] as String,
        timestamp: DateTime.parse(json['timestamp'] as String),
        agentId: json['agent_id'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role,
        'content': content,
        'timestamp': timestamp.toIso8601String(),
        if (agentId != null) 'agent_id': agentId,
      };

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';
}
