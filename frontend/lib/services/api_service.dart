import 'dart:convert';
import 'package:dio/dio.dart';
import '../core/constants.dart';
import '../models/agent.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  late final Dio _dio = Dio(
    BaseOptions(
      baseUrl: kApiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(minutes: 5),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  // ── Chat ────────────────────────────────────────────────────────────────────

  Future<String> sendMessage(
    String message, {
    String? sessionId,
    String? agentId,
  }) async {
    final resp = await _dio.post(
      agentId != null ? '/chat/agent/$agentId' : '/chat/',
      data: {
        'message': message,
        if (sessionId != null) 'session_id': sessionId,
      },
    );
    return resp.data['content'] as String;
  }

  // ── Manus agent (full result) ────────────────────────────────────────────────

  Future<ManusTaskState> runAgent(String task) async {
    final resp = await _dio.post('/agents/run', data: {'task': task});
    return ManusTaskState.fromJson(resp.data as Map<String, dynamic>);
  }

  // ── Manus agent (SSE streaming) ──────────────────────────────────────────────

  Stream<ManusTaskState> runAgentStream(String task) async* {
    final resp = await _dio.post<ResponseBody>(
      '/agents/run/stream',
      data: {'task': task},
      options: Options(responseType: ResponseType.stream),
    );

    final stream = resp.data!.stream;
    final buffer = StringBuffer();

    await for (final bytes in stream) {
      buffer.write(utf8.decode(bytes));
      final raw = buffer.toString();
      final lines = raw.split('\n');

      for (int i = 0; i < lines.length - 1; i++) {
        final line = lines[i].trim();
        if (line.startsWith('data: ')) {
          final jsonStr = line.substring(6);
          try {
            final map = jsonDecode(jsonStr) as Map<String, dynamic>;
            yield ManusTaskState.fromJson(map);
          } catch (_) {}
        }
      }
      // Keep incomplete line in buffer
      buffer.clear();
      if (lines.isNotEmpty) buffer.write(lines.last);
    }
  }
}
