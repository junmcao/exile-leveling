import { useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback, useEffect, useMemo } from "react";
import { FaArrowLeft, FaCheck } from "react-icons/fa";
import { AutoProgressChip } from "../../components/AutoProgressChip";
import { FragmentStep } from "../../components/FragmentStep";
import { GemReward } from "../../components/ItemReward";
import { Sidebar } from "../../components/Sidebar";
import {
  completedSelector,
  findCurrentIndex,
  tasksSelector,
  type Task,
} from "../../state/progress";
import { activeEdgeAtom, nextEdgeAtom } from "../../state/route";
import styles from "./styles.module.css";

const UPCOMING_COUNT = 3;

function TaskContent({
  task,
  showSubSteps,
}: {
  task: Task;
  showSubSteps: boolean;
}) {
  if (task.step.type === "fragment_step")
    return (
      <FragmentStep step={task.step} initialShowSubSteps={showSubSteps} />
    );

  return (
    <GemReward
      requiredGem={task.step.requiredGem}
      count={task.step.count}
      rewardType={task.step.rewardType}
    />
  );
}

export default function FocusContainer() {
  const tasks = useAtomValue(tasksSelector);
  const completed = useAtomValue(completedSelector);
  const activeEdge = useAtomValue(activeEdgeAtom)[0];

  const currentIndex = useMemo(
    () => findCurrentIndex(tasks, completed, activeEdge),
    [tasks, completed, activeEdge],
  );

  const complete = useAtomCallback(
    useCallback((get, set, task: Task) => {
      set(task.completed, true);
      if (task.edgeIndex !== null && task.edgeIndex > get(activeEdgeAtom)[0])
        set(nextEdgeAtom(task.edgeIndex));
    }, []),
  );

  const undo = useAtomCallback(
    useCallback((get, set, task: Task) => {
      set(task.completed, false);
      if (
        task.edgeIndex !== null &&
        task.edgeIndex > 0 &&
        task.edgeIndex <= get(activeEdgeAtom)[0]
      )
        set(nextEdgeAtom(task.edgeIndex - 1));
    }, []),
  );

  const current = tasks[currentIndex] as Task | undefined;
  const previous = tasks[currentIndex - 1] as Task | undefined;

  const done = () => current && complete(current);
  const back = () => previous && undo(previous);

  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === "ArrowRight") done();
      else if (ev.key === "ArrowLeft") back();
      else if (ev.key === " " && ev.target === document.body) {
        ev.preventDefault();
        done();
      } else return;

      ev.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const upcoming = tasks.slice(
    currentIndex + 1,
    currentIndex + 1 + UPCOMING_COUNT,
  );
  const percent = tasks.length > 0 ? (currentIndex / tasks.length) * 100 : 0;

  return (
    <>
      <Sidebar />
      <div className={styles.focus}>
        <div className={styles.progress}>
          <div className={styles.progressText}>
            <span>{current ? current.sectionName : "Finished"}</span>
            <AutoProgressChip />
            <span>
              {Math.min(currentIndex + 1, tasks.length)} / {tasks.length}
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {previous && (
          <button className={styles.previous} onClick={back}>
            <FaCheck className="inlineIcon" aria-hidden />
            <TaskContent task={previous} showSubSteps={false} />
          </button>
        )}

        {current ? (
          <div className={styles.card}>
            <TaskContent
              key={currentIndex}
              task={current}
              showSubSteps={true}
            />
          </div>
        ) : (
          <div className={styles.card}>Route complete</div>
        )}

        <div className={styles.actions}>
          <button
            className={styles.back}
            onClick={back}
            disabled={!previous}
            aria-label="Previous step"
          >
            <FaArrowLeft aria-hidden />
          </button>
          <button className={styles.done} onClick={done} disabled={!current}>
            <FaCheck aria-hidden /> Done
          </button>
        </div>

        {upcoming.length > 0 && (
          <ol className={styles.upcoming}>
            {upcoming.map((task, i) => (
              <li key={currentIndex + 1 + i}>
                <TaskContent task={task} showSubSteps={false} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
