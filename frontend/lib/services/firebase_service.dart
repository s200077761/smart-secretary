import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/message.dart';

class FirebaseService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String? get _uid => _auth.currentUser?.uid;

  // ── Messages ─────────────────────────────────────────────────────────────

  Stream<List<Message>> messagesStream(String sessionId) {
    if (_uid == null) return const Stream.empty();
    return _db
        .collection('users')
        .doc(_uid)
        .collection('sessions')
        .doc(sessionId)
        .collection('messages')
        .orderBy('timestamp')
        .snapshots()
        .map((snap) => snap.docs
            .map((d) => Message.fromJson(d.data()))
            .toList());
  }

  Future<void> saveMessage(String sessionId, Message msg) async {
    if (_uid == null) return;
    await _db
        .collection('users')
        .doc(_uid)
        .collection('sessions')
        .doc(sessionId)
        .collection('messages')
        .doc(msg.id)
        .set(msg.toJson());
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  Future<void> upsertSession(String sessionId, {String title = ''}) async {
    if (_uid == null) return;
    await _db
        .collection('users')
        .doc(_uid)
        .collection('sessions')
        .doc(sessionId)
        .set({
      'id': sessionId,
      'title': title,
      'updated_at': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Stream<List<Map<String, dynamic>>> sessionsStream() {
    if (_uid == null) return const Stream.empty();
    return _db
        .collection('users')
        .doc(_uid)
        .collection('sessions')
        .orderBy('updated_at', descending: true)
        .limit(50)
        .snapshots()
        .map((snap) => snap.docs.map((d) => d.data()).toList());
  }
}
