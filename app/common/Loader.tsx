import { RetryIcon } from "./icons";

export default function Loader() {
  return (
    <div className="flex gap-2 items-center justify-center my-4 text-gray-600 dark:text-gray-300">
      <div className="animate-spin">
        <RetryIcon />{" "}
      </div>
      <span className="animate-pulse">Loading...</span>
    </div>
  );
}
