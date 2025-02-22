import mongoose, { Document, Schema, Types } from "mongoose";

interface IPriorityLog {
  oldPriority: string;
  newPriority: string;
  reason: string;
  timestamp: Date;
}

interface ITask extends Document {
  title: string;
  description?: string;
  completed: boolean;
  priority: string; // "low", "medium", "high", "completed"
  previousPriority?: string;
  dueDate: Date;
  dueTime: Date;
  status: string; // "pending", "in-progress", "completed"
  reminderTime?: Date;
  userId: Types.ObjectId;
  retouchedByAI: boolean; // Tracks if AI has analyzed the task
  priorityLogs: IPriorityLog[]; // Logs priority changes
  createdAt: Date;
  updatedAt: Date;
  progress: Number;
  notificationSent: boolean;
}

const PriorityLogSchema: Schema = new Schema({
  oldPriority: {
    type: String,
    enum: ["Low", "Medium", "High", "Completed"],
    required: true,
  },
  newPriority: {
    type: String,
    enum: ["Low", "Medium", "High", "Completed"],
    required: true,
  },
  reason: { type: String, required: true },
  progress: { type: Number },
  timestamp: { type: Date, default: Date.now },
});

const TaskSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    completed: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Completed"],
      default: "Medium",
      required: true,
    },
    previousPriority: { type: String },
    dueDate: { type: Date, required: true },
    dueTime: { type: Date },
    status: {
      type: String,
      enum: ["Pending", "In-progress", "Completed"],
      default: "Pending",
    },
    reminderTime: { type: Date },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    retouchedByAI: { type: Boolean, default: false }, // Indicates if AI has modified the task
    priorityLogs: { type: [PriorityLogSchema], default: [] }, // Stores priority change history
    notificationSent: {
      type: Boolean,
      default: false,
    }, // Indicates if a reminder notification has been sent
  },

  { timestamps: true }
);

const Task = mongoose.model<ITask>("Task", TaskSchema);

export default Task;
