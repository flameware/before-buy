import { cn } from "@/lib/utils";

// shadcn 기본값은 `bg-accent`다. 라이트에서 `--accent`와 `--muted`는 같은 값이라
// 지금은 어느 쪽을 써도 같지만, 다크에서만 갈라진다. `--muted`로 고정해 둔다 —
// skeleton은 어떤 팔레트에서도 강조 요소가 아니다.

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
