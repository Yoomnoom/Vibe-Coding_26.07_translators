"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "visit-counted-date";

function todayInKst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

// 앱 안에 눈에 띄지 않게 오늘 방문자 수를 표시한다 (요청: "거슬리지않게").
// 브라우저 세션당 한 번만 증가 요청을 보내고, 그 외에는 조회만 한다.
// 노션 연동이 안 돼 있거나 실패하면 그냥 아무것도 렌더링하지 않는다 — 깨진 UI를 보여주지 않기 위해.
export function VisitCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const today = todayInKst();
    const countedDate = sessionStorage.getItem(STORAGE_KEY);
    const method = countedDate === today ? "GET" : "POST";

    fetch("/api/visit", { method })
      .then((res) => res.json())
      .then((data: { count: number | null }) => {
        if (typeof data.count === "number") {
          setCount(data.count);
          if (method === "POST") sessionStorage.setItem(STORAGE_KEY, today);
        }
      })
      .catch(() => {});
  }, []);

  if (count === null) return null;

  return <p className="font-mono text-[11px] text-foreground/30">오늘 방문 {count}명</p>;
}
