"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";
import equal from "fast-deep-equal";

import { Markdown } from "./markdown";
import { ABORTED, cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: any[];
};
import {
  Camera,
  CheckCircle,
  CircleSlash,
  Clock,
  Keyboard,
  KeyRound,
  Loader2,
  MousePointer,
  MousePointerClick,
  ScrollText,
  StopCircle,
} from "lucide-react";

const PurePreviewMessage = ({
  message,
  isLatestMessage,
  status,
}: {
  message: Message & { preActionScreenshots?: Record<string, string>; postActionScreenshots?: Record<string, string> };
  isLoading: boolean;
  status: "error" | "submitted" | "streaming" | "ready";
  isLatestMessage: boolean;
}) => {
  return (
    <AnimatePresence key={message.id}>
      <motion.div
        className="w-full mx-auto px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        key={`message-${message.id}`}
        data-role={message.role}
      >
        <div
          className={cn(
            "flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
            "group-data-[role=user]/message:w-fit",
          )}
        >
          {/* {message.role === "assistant" && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )} */}

          <div className="flex flex-col w-full">
            {message.content && (
              <motion.div
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                key={`message-${message.id}-content`}
                className="flex flex-row gap-2 items-start w-full pb-4"
              >
                <div
                  className={cn("flex flex-col gap-4", {
                    "bg-secondary text-secondary-foreground px-3 py-2 rounded-xl":
                      message.role === "user",
                  })}
                >
                  <Markdown>{message.content}</Markdown>
                  {/* Blinking cursor during streaming for assistant messages */}
                  {message.role === "assistant" && isLatestMessage && status === "streaming" && (
                    <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1"></span>
                  )}
                </div>
              </motion.div>
            )}
            {message.parts?.map((part, i) => {
              switch (part.type) {
                case "text":
                  return (
                    <motion.div
                      initial={{ y: 5, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      key={`message-${message.id}-part-${i}`}
                      className="flex flex-row gap-2 items-start w-full pb-4"
                    >
                      <div
                        className={cn("flex flex-col gap-4", {
                          "bg-secondary text-secondary-foreground px-3 py-2 rounded-xl":
                            message.role === "user",
                        })}
                      >
                        <Markdown>{part.text}</Markdown>
                      </div>
                    </motion.div>
                  );
                case "tool-invocation":
                  const { toolName, toolCallId, state, args, argsText } =
                    part.toolInvocation;

                  if (toolName === "computer" || (state === "streaming" && !toolName)) {
                    const {
                      action,
                      coordinate,
                      text,
                      duration,
                      scroll_amount,
                      scroll_direction,
                    } = args;
                    let actionLabel = "";
                    let actionDetail = "";
                    let ActionIcon = null;

                    if (state === "streaming") {
                      if (action) {
                        switch (action) {
                          case "screenshot":
                            actionLabel = "Taking screenshot";
                            ActionIcon = Camera;
                            break;
                          case "left_click":
                            actionLabel = "Left clicking";
                            actionDetail = coordinate
                              ? `at (${coordinate[0]}, ${coordinate[1]})`
                              : argsText ? `(streaming...)` : "";
                            ActionIcon = MousePointer;
                            break;
                          case "right_click":
                            actionLabel = "Right clicking";
                            actionDetail = coordinate
                              ? `at (${coordinate[0]}, ${coordinate[1]})`
                              : argsText ? `(streaming...)` : "";
                            ActionIcon = MousePointerClick;
                            break;
                          case "double_click":
                            actionLabel = "Double clicking";
                            actionDetail = coordinate
                              ? `at (${coordinate[0]}, ${coordinate[1]})`
                              : argsText ? `(streaming...)` : "";
                            ActionIcon = MousePointerClick;
                            break;
                          case "mouse_move":
                            actionLabel = "Moving mouse";
                            actionDetail = coordinate
                              ? `to (${coordinate[0]}, ${coordinate[1]})`
                              : argsText ? `(streaming...)` : "";
                            ActionIcon = MousePointer;
                            break;
                          case "type":
                            actionLabel = "Typing";
                            actionDetail = text ? `"${text}"` : argsText ? `(streaming...)` : "";
                            ActionIcon = Keyboard;
                            break;
                          case "key":
                            actionLabel = "Pressing key";
                            actionDetail = text ? `"${text}"` : argsText ? `(streaming...)` : "";
                            ActionIcon = KeyRound;
                            break;
                          case "wait":
                            actionLabel = "Waiting";
                            actionDetail = duration ? `${duration} seconds` : argsText ? `(streaming...)` : "";
                            ActionIcon = Clock;
                            break;
                          case "scroll":
                            actionLabel = "Scrolling";
                            actionDetail =
                              scroll_direction && scroll_amount
                                ? `${scroll_direction} by ${scroll_amount}`
                                : argsText ? `(streaming...)` : "";
                            ActionIcon = ScrollText;
                            break;
                          case "left_click_drag":
                            actionLabel = "Dragging";
                            const { start_coordinate } = args;
                            actionDetail = start_coordinate && coordinate
                              ? `from (${start_coordinate[0]}, ${start_coordinate[1]}) to (${coordinate[0]}, ${coordinate[1]})`
                              : argsText ? `(streaming...)` : "";
                            ActionIcon = MousePointer;
                            break;
                          default:
                            actionLabel = action;
                            actionDetail = argsText ? argsText.slice(0, 40) : "";
                            ActionIcon = Loader2;
                        }
                      } else if (argsText) {
                        actionLabel = "Generating";
                        actionDetail = argsText.slice(0, 50);
                        ActionIcon = Loader2;
                      } else {
                        actionLabel = "Starting";
                        ActionIcon = Loader2;
                      }
                    } else if (action) {
                      switch (action) {
                        case "screenshot":
                          actionLabel = "Taking screenshot";
                          ActionIcon = Camera;
                          break;
                        case "left_click":
                          actionLabel = "Left clicking";
                          actionDetail = coordinate
                            ? `at (${coordinate[0]}, ${coordinate[1]})`
                            : "";
                          ActionIcon = MousePointer;
                          break;
                        case "right_click":
                          actionLabel = "Right clicking";
                          actionDetail = coordinate
                            ? `at (${coordinate[0]}, ${coordinate[1]})`
                            : "";
                          ActionIcon = MousePointerClick;
                          break;
                        case "double_click":
                          actionLabel = "Double clicking";
                          actionDetail = coordinate
                            ? `at (${coordinate[0]}, ${coordinate[1]})`
                            : "";
                          ActionIcon = MousePointerClick;
                          break;
                        case "mouse_move":
                          actionLabel = "Moving mouse";
                          actionDetail = coordinate
                            ? `to (${coordinate[0]}, ${coordinate[1]})`
                            : "";
                          ActionIcon = MousePointer;
                          break;
                        case "type":
                          actionLabel = "Typing";
                          actionDetail = text ? `"${text}"` : "";
                          ActionIcon = Keyboard;
                          break;
                        case "key":
                          actionLabel = "Pressing key";
                          actionDetail = text ? `"${text}"` : "";
                          ActionIcon = KeyRound;
                          break;
                        case "wait":
                          actionLabel = "Waiting";
                          actionDetail = duration ? `${duration} seconds` : "";
                          ActionIcon = Clock;
                          break;
                        case "scroll":
                          actionLabel = "Scrolling";
                          actionDetail =
                            scroll_direction && scroll_amount
                              ? `${scroll_direction} by ${scroll_amount}`
                              : "";
                          ActionIcon = ScrollText;
                          break;
                        case "left_click_drag":
                          actionLabel = "Dragging";
                          const { start_coordinate } = args;
                          actionDetail = start_coordinate && coordinate
                            ? `from (${start_coordinate[0]}, ${start_coordinate[1]}) to (${coordinate[0]}, ${coordinate[1]})`
                            : "";
                          ActionIcon = MousePointer;
                          break;
                        default:
                          actionLabel = action;
                          ActionIcon = MousePointer;
                          break;
                      }
                    } else if (state === "streaming") {
                      actionLabel = "Preparing action";
                      ActionIcon = Loader2;
                    }

                    return (
                      <motion.div
                        initial={{ y: 5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        key={`message-${message.id}-part-${i}`}
                        className={cn(
                          "flex flex-col gap-2 p-2 mb-3 text-sm rounded-md border",
                          {
                            "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800": state === "streaming",
                            "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800": state === "call" && isLatestMessage && status !== "ready",
                            "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800": state === "result" && part.toolInvocation.result !== ABORTED,
                            "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800": state === "result" && part.toolInvocation.result === ABORTED,
                            "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800": state === "call" && (!isLatestMessage || status === "ready"),
                          }
                        )}
                      >
                        <div className="flex-1 flex items-center justify-center">
                          <div className="flex items-center justify-center w-8 h-8 bg-zinc-50 dark:bg-zinc-800 rounded-full">
                            {ActionIcon && <ActionIcon className="w-4 h-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium font-mono flex items-baseline gap-2">
                              {/* Status emoji prefix */}
                              {state === "streaming" && <span className="animate-pulse">⏳</span>}
                              {state === "call" && isLatestMessage && status !== "ready" && <span className="animate-pulse">⚡</span>}
                              {state === "result" && part.toolInvocation.result !== ABORTED && <span>✅</span>}
                              {state === "result" && part.toolInvocation.result === ABORTED && <span>❌</span>}
                              {actionLabel}
                              {actionDetail && (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                                  {actionDetail}
                                </span>
                              )}
                            </div>
                            {/* Status label */}
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {state === "streaming" && "Pending..."}
                              {state === "call" && isLatestMessage && status !== "ready" && "Executing..."}
                              {state === "result" && part.toolInvocation.result !== ABORTED && "Success"}
                              {state === "result" && part.toolInvocation.result === ABORTED && "Aborted"}
                            </div>
                          </div>
                          <div className="w-5 h-5 flex items-center justify-center">
                            {state === "streaming" ? (
                              <Loader2 className="animate-spin h-4 w-4 text-orange-500" />
                            ) : state === "call" ? (
                              isLatestMessage && status !== "ready" ? (
                                <Loader2 className="animate-spin h-4 w-4 text-yellow-500" />
                              ) : (
                                <StopCircle className="h-4 w-4 text-red-500" />
                              )
                            ) : state === "result" ? (
                              part.toolInvocation.result === ABORTED ? (
                                <CircleSlash
                                size={14}
                                className="text-red-600"
                                />                              ) : (
                                <CheckCircle
                                  size={14}
                                  className="text-green-600"
                                />
                              )
                            ) : null}
                          </div>
                        </div>
                        {/* Pre-action screenshot */}
                        {message.preActionScreenshots && message.preActionScreenshots[toolCallId] && action !== "screenshot" && (
                          <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-950/10">
                            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                              📸 BEFORE ACTION
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`data:image/png;base64,${message.preActionScreenshots[toolCallId]}`}
                              alt="Pre-action Screenshot"
                              className="w-full aspect-[1024/768] rounded-sm border border-blue-200 dark:border-blue-800"
                            />
                          </div>
                        )}
                        {/* Result screenshot for screenshot action */}
                        {state === "result" ? (
                          part.toolInvocation.result.type === "image" && (
                            <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
                              <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
                                📸 Screenshot captured
                              </div>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`data:image/png;base64,${part.toolInvocation.result.data}`}
                                alt="Screenshot"
                                className="w-full aspect-[1024/768] rounded-sm"
                              />
                            </div>
                          )
                        ) : action === "screenshot" ? (
                          <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
                            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 animate-pulse">
                              📸 Taking screenshot...
                            </div>
                            <div className="w-full aspect-[1024/768] rounded-sm bg-zinc-200 dark:bg-zinc-800 animate-pulse"></div>
                          </div>
                        ) : null}
                        {/* Post-action screenshot */}
                        {message.postActionScreenshots && message.postActionScreenshots[toolCallId] && action !== "screenshot" && (
                          <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 bg-green-50/50 dark:bg-green-950/10">
                            <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                              📸 AFTER ACTION
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`data:image/png;base64,${message.postActionScreenshots[toolCallId]}`}
                              alt="Post-action Screenshot"
                              className="w-full aspect-[1024/768] rounded-sm border border-green-200 dark:border-green-800"
                            />
                          </div>
                        )}
                      </motion.div>
                    );
                  }
                  if (toolName === "bash" || (state === "streaming" && !toolName && argsText)) {
                    const { command } = args;
                    const displayCommand = state === "streaming" && argsText 
                      ? argsText.slice(0, 60)
                      : command 
                        ? command.slice(0, 60)
                        : "...";

                    return (
                      <motion.div
                        initial={{ y: 5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        key={`message-${message.id}-part-${i}`}
                        className={cn(
                          "flex items-center gap-2 p-2 mb-3 text-sm rounded-md border",
                          {
                            "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800": state === "streaming",
                            "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800": state === "call" && isLatestMessage && status !== "ready",
                            "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800": state === "result",
                            "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800": state === "call" && (!isLatestMessage || status === "ready"),
                          }
                        )}
                      >
                        <div className="flex items-center justify-center w-8 h-8 bg-zinc-50 dark:bg-zinc-800 rounded-full">
                          <ScrollText className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium flex items-baseline gap-2">
                            {/* Status emoji prefix */}
                            {state === "streaming" && <span className="animate-pulse">⏳</span>}
                            {state === "call" && isLatestMessage && status !== "ready" && <span className="animate-pulse">⚡</span>}
                            {state === "result" && <span>✅</span>}
                            {state === "streaming" ? "Generating command" : "Running command"}
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal font-mono">
                              {displayCommand}
                            </span>
                          </div>
                          {/* Status label */}
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {state === "streaming" && "Pending..."}
                            {state === "call" && isLatestMessage && status !== "ready" && "Executing..."}
                            {state === "result" && "Success"}
                          </div>
                        </div>
                        <div className="w-5 h-5 flex items-center justify-center">
                          {state === "streaming" ? (
                            <Loader2 className="animate-spin h-4 w-4 text-orange-500" />
                          ) : state === "call" ? (
                            isLatestMessage && status !== "ready" ? (
                              <Loader2 className="animate-spin h-4 w-4 text-yellow-500" />
                            ) : (
                              <StopCircle className="h-4 w-4 text-red-500" />
                            )
                          ) : state === "result" ? (
                            <CheckCircle size={14} className="text-green-600" />
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  }
                  return (
                    <div key={toolCallId}>
                      <h3>
                        {toolName}: {state}
                      </h3>
                      <pre>{JSON.stringify(args, null, 2)}</pre>
                    </div>
                  );

                default:
                  return null;
              }
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.message.preActionScreenshots, nextProps.message.preActionScreenshots)) return false;
    if (!equal(prevProps.message.postActionScreenshots, nextProps.message.postActionScreenshots)) return false;

    return true;
  },
);
