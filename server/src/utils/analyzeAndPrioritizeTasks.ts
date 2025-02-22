import { HfInference } from "@huggingface/inference";
import Task from "../models/Task";

const client = new HfInference(process.env.HUGGINGFACE_API_KEY);

export const analyzeAndPrioritizeTasks = async (userId: string) => {
  try {
    if (!userId) {
      throw new Error("userId is required but was not provided.");
    }

    const currentDate = new Date();

    const tasks = await Task.find({
      userId,
      completed: false,
    });

    if (tasks.length === 0) {
      console.log(`No eligible tasks to analyze for user ${userId}.`);
      return;
    }

    for (const task of tasks) {
      const { _id, title, description, priority, dueDate } = task;

      console.log(`Analyzing task for user ${userId}: ${title}`);

      // Prepare analysis prompt
      const analysisInput = `Analyze this task and return only a JSON object with priority/status recommendations:
Task: ${title}
Description: ${description || "No description provided"}
Current Priority: ${priority}
Due Date: ${dueDate.toISOString()}
Reference Date: ${currentDate.toISOString()}

Required JSON format:
{
  "newPriority": "Low" | "Medium" | "High" | "Completed",
  "newStatus": "Pending" | "In-progress" | "Completed",
  "reason": "string explanation"
}

Rules:
- If due date < reference date, set priority="High" and status="Pending"
- Explain any changes in the reason field
- Return only the JSON object, no other text`;

      // Use direct completion instead of streaming
      const response = await client.textGeneration({
        model: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
        inputs: analysisInput,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.6,
          return_full_text: false,
        },
      });

      let output = response.generated_text;
      console.log("Model response:", output);

      // Extract JSON using regex
      const jsonRegex = /\{[\s\S]*?\}/g;
      const matches = output.match(jsonRegex);

      if (!matches) {
        console.error("No JSON found in response for task:", title);
        continue;
      }

      // Take the longest match as it's likely the complete JSON
      const jsonStr = matches.reduce((a, b) => (a.length > b.length ? a : b));

      let aiResponse;
      try {
        aiResponse = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Failed to parse JSON for task:", title);
        console.error("JSON string:", jsonStr);
        continue;
      }

      // Validate response structure
      if (
        !aiResponse.newPriority ||
        !aiResponse.newStatus ||
        typeof aiResponse.reason !== "string"
      ) {
        console.error("Invalid AI response structure for task:", title);
        continue;
      }

      // Update task if needed
      const newPriority = aiResponse.newPriority;
      const newStatus = aiResponse.newStatus;
      const reason = aiResponse.reason;

      let isUpdated = false;

      if (newPriority !== priority) {
        task.priorityLogs.push({
          oldPriority: priority,
          newPriority,
          reason,
          timestamp: new Date(),
        });
        task.priority = newPriority;
        isUpdated = true;
      }

      if (newStatus !== task.status) {
        task.status = newStatus;
        isUpdated = true;
      }

      if (isUpdated) {
        task.retouchedByAI = true;
        await task.save();
        console.log(`Task "${title}" updated:`, {
          priority: `${priority} → ${newPriority}`,
          status: `${task.status} → ${newStatus}`,
          reason,
        });
      } else {
        console.log(`No changes needed for task "${title}"`);
      }
    }

    console.log(`Task analysis complete for user ${userId}`);
  } catch (error) {
    console.error("Error during task analysis:", error);
    throw new Error("Failed to analyze and prioritize tasks");
  }
};
