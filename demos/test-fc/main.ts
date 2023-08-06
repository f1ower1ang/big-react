import {
  unstable_ImmediatePriority as ImmediatePriority,
  unstable_UserBlockingPriority as UserBlockingPriority,
  unstable_NormalPriority as NormalPriority,
  unstable_LowPriority as LowPriority,
  unstable_IdlePriority as IdlePriority,
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield as shouldYield,
  CallbackNode,
  unstable_getFirstCallbackNode as getFirstCallbackNode,
  unstable_cancelCallback as cancelCallback,
} from "scheduler";
import "./main.css";
const root = document.getElementById("root");

type Priority =
  | typeof ImmediatePriority
  | typeof UserBlockingPriority
  | typeof NormalPriority
  | typeof LowPriority
  | typeof IdlePriority;

interface Work {
  count: number; // 类比React组件数量
  priority: Priority;
}

const workList: Work[] = [];
let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

[ImmediatePriority, UserBlockingPriority, NormalPriority, LowPriority].forEach(
  (priority) => {
    const btn = document.createElement("button");
    btn.innerText = [
      "",
      "ImmediatePriority",
      "UserBlockingPriority",
      "NormalPriority",
      "LowPriority",
    ][priority];
    root?.appendChild(btn);

    btn &&
      btn.addEventListener("click", () => {
        workList.unshift({
          count: 100,
          priority: priority as Priority,
        });
        schedule();
      });
  }
);

function schedule() {
  workList.sort((a, b) => a.priority - b.priority);
  const cbNode = getFirstCallbackNode();
  const curWork = workList[0];
  // 策略逻辑
  if (!curWork) {
    curCallback = null;
    cbNode && cancelCallback(cbNode);
    return;
  }
  const { priority: curPriority } = curWork;
  if (prevPriority === curPriority) return;

  // 更高优先级的work
  cbNode && cancelCallback(cbNode);

  curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

function perform(work: Work, didTimeout?: boolean) {
  const needSync = work.priority === ImmediatePriority || didTimeout;
  while ((needSync || !shouldYield()) && work.count) {
    work.count--;
    insertSpan(work.priority);
  }

  // 中断执行 或 执行完
  prevPriority = work.priority;
  if (!work.count) {
    const workIndex = workList.indexOf(work);
    workList.splice(workIndex, 1);
    prevPriority = IdlePriority;
  }

  const prevCallback = curCallback;
  schedule();
  const newCallback = curCallback;

  // 优先级相同，不需要重新调度
  if (newCallback && prevCallback === newCallback) {
    return perform.bind(null, work);
  }

  // 对于只有一种work的情况
  // return perform.bind(null, work);
}

function insertSpan(content) {
  const span = document.createElement("span");
  span.innerText = content;
  span.className = `pri-${content}`;
  doSomeBusyWork(5000000);
  root && root.appendChild(span);
}

function doSomeBusyWork(count: number) {
  let result = 0;
  while (count--) {
    result += count;
  }
}
