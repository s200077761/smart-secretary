import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../core/theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: ListView(
        children: [
          // Profile card
          Padding(
            padding: const EdgeInsets.all(16),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: kPrimary.withOpacity(0.15),
                      child: const Icon(Icons.person, color: kPrimary, size: 30),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          auth.currentUser?.displayName ?? 'مستخدم ضيف',
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                        ),
                        Text(
                          auth.currentUser?.email ?? '',
                          style: TextStyle(color: cs.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // About
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('عن التطبيق'),
            subtitle: const Text('السكرتير الذكي v2.0 — Python + Flutter'),
          ),
          const Divider(),

          // GitHub / Licenses
          ListTile(
            leading: const Icon(Icons.code_outlined),
            title: const Text('رخصة MIT'),
            subtitle: const Text('مشروع مفتوح المصدر'),
          ),

          ListTile(
            leading: const Icon(Icons.gavel_outlined),
            title: const Text('Apache License 2.0'),
            subtitle: const Text('مكتبات مستخدمة'),
          ),

          const Divider(),

          // Sign out
          ListTile(
            leading: Icon(Icons.logout, color: cs.error),
            title: Text('تسجيل الخروج', style: TextStyle(color: cs.error)),
            onTap: () async {
              await auth.signOut();
              if (context.mounted) context.go('/splash');
            },
          ),
        ],
      ),
    );
  }
}
