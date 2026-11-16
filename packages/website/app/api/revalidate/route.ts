import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  isRevalidateRequestAuthorized,
  isRevalidateTokenConfigured,
} from '../../../utils/revalidateAuth';

export async function GET(request: NextRequest) {
  const providedToken = request.headers.get('x-vanblog-isr-token');
  if (!isRevalidateRequestAuthorized(providedToken)) {
    const status = isRevalidateTokenConfigured() ? 401 : 503;
    return NextResponse.json({ revalidated: false, message: 'ISR token invalid' }, { status });
  }

  const path = request.nextUrl.searchParams.get('path');
  if (!path) {
    return new NextResponse('触发增量增量渲染失败', { status: 500 });
  }

  // `type=layout` drops every page under the given layout, which the server uses
  // when public masking rules change.
  const typeParam = request.nextUrl.searchParams.get('type');
  const type = typeParam === 'layout' || typeParam === 'page' ? typeParam : undefined;

  try {
    if (type) {
      revalidatePath(path, type);
    } else {
      revalidatePath(path);
    }
    return NextResponse.json({ revalidated: true });
  } catch (error) {
    console.log(error);
    return new NextResponse('触发增量增量渲染失败', { status: 500 });
  }
}
