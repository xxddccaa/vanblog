import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path');
  if (!path) {
    return new NextResponse('触发增量增量渲染失败', { status: 500 });
  }

  try {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true });
  } catch (error) {
    console.log(error);
    return new NextResponse('触发增量增量渲染失败', { status: 500 });
  }
}
