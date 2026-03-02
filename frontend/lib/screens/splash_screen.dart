import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../core/theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final auth = context.read<AuthService>();
    if (auth.isSignedIn) {
      if (mounted) context.go('/chat');
    }
  }

  Future<void> _signInGoogle() async {
    setState(() { _loading = true; _error = null; });
    try {
      await context.read<AuthService>().signInWithGoogle();
      if (mounted) context.go('/chat');
    } catch (e) {
      setState(() { _error = 'فشل تسجيل الدخول: $e'; });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  Future<void> _continueAnonymously() async {
    setState(() { _loading = true; _error = null; });
    try {
      await context.read<AuthService>().signInAnonymously();
      if (mounted) context.go('/chat');
    } catch (e) {
      setState(() { _error = 'فشل الدخول: $e'; });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              Icon(Icons.memory_outlined, size: 72, color: kPrimary),
              const SizedBox(height: 24),
              Text(
                'السكرتير الذكي',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: kPrimary,
                    ),
              ),
              const SizedBox(height: 12),
              Text(
                'مساعدك الشخصي المدعوم بالذكاء الاصطناعي',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: cs.onSurfaceVariant,
                    ),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              if (_error != null) ...[
                Text(_error!, style: TextStyle(color: cs.error)),
                const SizedBox(height: 12),
              ],
              if (_loading)
                const CircularProgressIndicator()
              else ...[
                FilledButton.icon(
                  onPressed: _signInGoogle,
                  icon: const Icon(Icons.login),
                  label: const Text('تسجيل الدخول بـ Google'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: _continueAnonymously,
                  child: const Text('المتابعة كضيف'),
                ),
              ],
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
