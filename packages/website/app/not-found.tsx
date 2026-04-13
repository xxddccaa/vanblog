import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute' }}
    >
      <div
        className="flex flex-col items-center justify-center select-none"
        style={{ transform: 'translateY(-30%)' }}
      >
        <Image alt="logo" src="/logo.svg" width={200} height={200} />
        <div className="mt-4 text-xl font-base text-gray-600 dark:text-dark">此页面不存在</div>
        <Link href="/" className="mt-4 text-base text-gray-600 dark:text-dark">
          返回主页
        </Link>
      </div>
    </div>
  );
}
