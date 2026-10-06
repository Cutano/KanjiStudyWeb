import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Timer } from "lucide-react";
import type { CharacterDetail, QuizPrompt } from "../../domain/types";
import { cleanReading } from "../../data/text";
import { promptLabels } from "./StudySetup";
import type { Question } from "./quiz";
interface Props {
  character: CharacterDetail;
  prompt: QuizPrompt;
  question: Question;
  selected: string | null;
  setSelected: (value: string) => void;
  saving: boolean;
  timerSeconds?: number;
  hideAnswers?: boolean;
  autoAdvance?: boolean;
  answer: (correct: boolean) => Promise<void>;
}
export function QuizStudy({
  character,
  prompt,
  question,
  selected,
  setSelected,
  saving,
  timerSeconds = 0,
  hideAnswers = false,
  autoAdvance = false,
  answer,
}: Props) {
  const [choicesVisible, setChoicesVisible] = useState(!hideAnswers);
  const [remaining, setRemaining] = useState(Math.ceil(timerSeconds));
  const answerRef = useRef(answer);
  answerRef.current = answer;
  useEffect(() => {
    if (!choicesVisible || selected !== null || timerSeconds <= 0) return;
    const end = Date.now() + timerSeconds * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (!left) setSelected("__timeout__");
    }, 200);
    return () => clearInterval(timer);
  }, [choicesVisible, selected, timerSeconds, setSelected]);
  useEffect(() => {
    if (!autoAdvance || selected === null) return;
    const timer = setTimeout(
      () => void answerRef.current(selected === character.key),
      1500,
    );
    return () => clearTimeout(timer);
  }, [selected, autoAdvance, character.key]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        !choicesVisible ||
        selected !== null ||
        saving ||
        (event.target as HTMLElement)?.matches("input,select,textarea")
      )
        return;
      if (/^[1-4]$/.test(event.key)) {
        const choice = question.choices[Number(event.key) - 1];
        if (choice) setSelected(choice.key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [choicesVisible, selected, saving, question, setSelected]);
  return (
    <div className="quiz-layout">
      <div className="quiz-prompt">
        <p className="study-eyebrow">{promptLabels[prompt]}</p>
        <h2
          lang={prompt === "meaning" ? "en" : "ja"}
          className={
            ["character", "kana", "kana-pair"].includes(prompt)
              ? "quiz-glyph"
              : ""
          }
        >
          {question.prompt}
        </h2>
        <p className="muted">{question.hint}</p>
      </div>
      {timerSeconds > 0 && choicesVisible && (
        <p className="quiz-timer" role="timer" aria-label="Time remaining">
          <Timer size={15} /> {remaining} seconds
        </p>
      )}
      {!choicesVisible ? (
        <button
          className="study-primary study-wide"
          onClick={() => setChoicesVisible(true)}
        >
          Show answer choices{timerSeconds > 0 ? " & start timer" : ""}
        </button>
      ) : (
        <div className="quiz-choices">
          {question.choices.map((choice, choiceIndex) => (
            <button
              key={choice.key}
              disabled={selected !== null || saving}
              className={
                selected !== null
                  ? choice.key === character.key
                    ? "correct"
                    : selected === choice.key
                      ? "incorrect"
                      : ""
                  : ""
              }
              onClick={() => setSelected(choice.key)}
            >
              <span className="quiz-choice-number">{choiceIndex + 1}</span>
              <span
                className={
                  ["character", "kana"].includes(prompt)
                    ? "quiz-text-choice"
                    : "quiz-character-choice"
                }
              >
                {choice.label}
              </span>
              {selected !== null && choice.key === character.key && (
                <Check size={22} />
              )}
            </button>
          ))}
        </div>
      )}
      {selected !== null && (
        <div
          className={`quiz-feedback ${selected === character.key ? "correct" : "incorrect"}`}
          role="status"
        >
          <div>
            <strong>
              {selected === character.key
                ? "That’s right."
                : selected === "__timeout__"
                  ? "Time is up. Let’s revisit this one."
                  : "Keep this one in mind."}
            </strong>
            <span>
              {character.glyph} · {character.meaning} ·{" "}
              {cleanReading(
                character.onReading ||
                  character.kunReading ||
                  character.reading,
              )}
            </span>
          </div>
          <button
            className="study-primary"
            disabled={saving}
            onClick={() => answer(selected === character.key)}
          >
            Continue <ArrowRight size={17} />
          </button>
        </div>
      )}
      <p className="study-keyboard-note">
        Keyboard: use 1–4 to choose an answer.
      </p>
    </div>
  );
}
