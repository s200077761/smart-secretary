import 'package:flutter/material.dart';
import '../models/agent.dart';
import '../widgets/agent_card.dart';
import '../widgets/manus_agent_view.dart';
import '../services/api_service.dart';

class AgentsScreen extends StatefulWidget {
  const AgentsScreen({super.key});

  @override
  State<AgentsScreen> createState() => _AgentsScreenState();
}

class _AgentsScreenState extends State<AgentsScreen> {
  final _api = ApiService();

  void _onAgentTap(Agent agent) {
    if (agent.isManus) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => const ManusAgentView(),
      );
    } else {
      _showAgentDialog(agent);
    }
  }

  void _showAgentDialog(Agent agent) {
    final controller = TextEditingController();
    String? result;
    bool loading = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.7,
            maxChildSize: 0.95,
            builder: (_, scrollCtrl) => ListView(
              controller: scrollCtrl,
              padding: const EdgeInsets.all(20),
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                // Title
                Row(
                  children: [
                    Icon(agent.icon, color: agent.color, size: 28),
                    const SizedBox(width: 10),
                    Text(agent.nameAr,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(agent.descriptionAr,
                    style: TextStyle(color: Colors.grey.shade600)),
                const SizedBox(height: 20),
                TextField(
                  controller: controller,
                  maxLines: 4,
                  textAlign: TextAlign.right,
                  decoration: const InputDecoration(
                    hintText: 'اكتب طلبك هنا...',
                    hintTextDirection: TextDirection.rtl,
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: loading
                      ? null
                      : () async {
                          if (controller.text.trim().isEmpty) return;
                          setModal(() { loading = true; result = null; });
                          try {
                            final resp = await _api.sendMessage(
                              controller.text.trim(),
                              agentId: agent.id,
                            );
                            setModal(() { result = resp; });
                          } catch (e) {
                            setModal(() { result = '❌ حدث خطأ: $e'; });
                          } finally {
                            setModal(() { loading = false; });
                          }
                        },
                  child: loading
                      ? const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('تنفيذ'),
                ),
                if (result != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(result!, textAlign: TextAlign.right),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الوكلاء')),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.95,
        ),
        itemCount: kAgents.length,
        itemBuilder: (ctx, i) => AgentCard(
          agent: kAgents[i],
          onTap: () => _onAgentTap(kAgents[i]),
        ),
      ),
    );
  }
}
