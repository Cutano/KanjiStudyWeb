import { useState } from "react";
import { BarChart3, Flame, Target, Timer } from "lucide-react";
import { statistics, localDayKey } from "../domain/study";
import type { CharacterKey } from "../domain/types";
import { useProfile } from "../state/useProfile";
import { RATING_LABELS } from "../lib/constants";
import { Empty } from "../components/common";

export function Progress({
  onAddToSet,
}: {
  onAddToSet: (keys: CharacterKey[]) => void;
}) {
  const profile = useProfile();
  const stats = statistics(profile);
  const [sort, setSort] = useState("accuracy");
  const [filter, setFilter] = useState("all");
  const rankings = Object.entries(profile.progress)
    .filter(
      ([, value]) =>
        value.reviews && (filter === "all" || value.rating === +filter),
    )
    .sort((a, b) =>
      sort === "accuracy"
        ? a[1].correct / a[1].reviews - b[1].correct / b[1].reviews
        : sort === "reviews"
          ? b[1].reviews - a[1].reviews
          : b[1].lastStudied - a[1].lastStudied,
    );
  const dayCounts = new Map<string, number>();
  for (const event of profile.events) {
    const day = localDayKey(event.at);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE BIGGER PICTURE</p>
          <h1>
            Look how far you’ve come<span className="accent-dot">.</span>
          </h1>
          <p className="subtitle">
            Every review leaves a little more knowledge behind.
          </p>
        </div>
      </div>
      <div className="metrics-grid">
        {[
          {
            icon: Flame,
            label: "Current streak",
            value: `${stats.streak} days`,
          },
          { icon: Target, label: "Accuracy", value: `${stats.accuracy}%` },
          {
            icon: BarChart3,
            label: "Total reviews",
            value: stats.totalReviews.toLocaleString(),
          },
          {
            icon: Timer,
            label: "Study time",
            value: `${Math.round(stats.totalTimeMs / 60000)} min`,
          },
        ].map((metric) => (
          <section className="metric-card" key={metric.label}>
            <metric.icon size={20} />
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </section>
        ))}
      </div>
      <section className="panel spaced-top">
        <div className="section-heading">
          <div>
            <h2>A habit, taking shape</h2>
            <p className="muted">Your last 20 weeks of practice</p>
          </div>
          <span className="badge">{stats.todayReviews} reviews today</span>
        </div>
        <div
          className="activity-grid"
          aria-label="Study activity over the last 140 days"
        >
          {Array.from({ length: 140 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - 139 + index);
            const day = localDayKey(date.getTime());
            const count = dayCounts.get(day) || 0;
            return (
              <div
                key={day}
                role="img"
                aria-label={`${day}: ${count} reviews`}
                title={`${day}: ${count} reviews`}
                className={`activity-cell intensity-${count === 0 ? 0 : count < 5 ? 1 : count < 15 ? 2 : count < 30 ? 3 : 4}`}
              />
            );
          })}
        </div>
        <div className="heatmap-legend">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((index) => (
            <span className={`activity-cell intensity-${index}`} key={index} />
          ))}
          <span>More</span>
        </div>
      </section>
      <div className="stats-columns">
        <section className="panel">
          <h2>This week</h2>
          <div className="bar-chart">
            {stats.last7Days.map((day) => (
              <div className="bar-column" key={day.day}>
                <span>{day.reviews}</span>
                <div className="bar-track">
                  <div
                    style={{
                      height: `${Math.max(day.reviews ? 3 : 0, (day.reviews / Math.max(profile.settings.dailyGoal, ...stats.last7Days.map((item) => item.reviews))) * 100)}%`,
                    }}
                  />
                </div>
                <span>
                  {new Date(`${day.day}T12:00:00`).toLocaleDateString("en", {
                    weekday: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Your growing familiarity</h2>
          <p className="muted">
            {stats.studied} characters explored · {stats.due} due for review
          </p>
          <div className="rating-distribution">
            {RATING_LABELS.map((label, index) => (
              <div key={label}>
                <span className={`rating-dot rating-${index}`} />
                <span>{label}</span>
                <div className="distribution-track">
                  <div
                    className={`rating-bg-${index}`}
                    style={{
                      width: `${(stats.ratingCounts[index] / Math.max(1, Object.keys(profile.progress).length)) * 100}%`,
                    }}
                  />
                </div>
                <strong>{stats.ratingCounts[index]}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <h2>Give a little extra attention</h2>
            <p className="muted">
              Turn your trickiest characters into a focused practice set.
            </p>
          </div>
          <button
            disabled={!rankings.length}
            className="button secondary"
            onClick={() =>
              onAddToSet(
                rankings.slice(0, 20).map(([key]) => key as CharacterKey),
              )
            }
          >
            Make a set from top 20
          </button>
        </div>
        <div className="library-controls">
          <label>
            Sort by
            <select
              aria-label="Ranking order"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="accuracy">Lowest accuracy</option>
              <option value="reviews">Most reviewed</option>
              <option value="recent">Recently studied</option>
            </select>
          </label>
          <label>
            Familiarity
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All ratings</option>
              {RATING_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {rankings.length ? (
          <div className="rankings-table">
            <div className="ranking-header">
              <span>Character</span>
              <span>Rating</span>
              <span>Reviews</span>
              <span>Accuracy</span>
            </div>
            {rankings.slice(0, 100).map(([key, value]) => (
              <a className="ranking-row" key={key} href={`#character/${key}`}>
                <span lang="ja">
                  {String.fromCodePoint(+key.split(":")[1])}
                </span>
                <span>{RATING_LABELS[value.rating]}</span>
                <span>{value.reviews}</span>
                <span>
                  {Math.round((value.correct / value.reviews) * 100)}%
                </span>
              </a>
            ))}
          </div>
        ) : (
          <Empty title="Your story starts with a review">
            Practice a few characters and watch your progress take shape.
          </Empty>
        )}
      </section>
    </div>
  );
}
