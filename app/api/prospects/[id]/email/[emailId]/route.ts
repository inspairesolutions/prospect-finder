import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// DELETE - eliminar una propuesta
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  try {
    const { id, emailId } = await params

    await prisma.emailProposal.deleteMany({
      where: { id: emailId, prospectId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete email proposal error:', error)
    return NextResponse.json({ error: 'Error al eliminar propuesta' }, { status: 500 })
  }
}

// PATCH - marcar como enviado
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  try {
    const { id, emailId } = await params

    const proposal = await prisma.emailProposal.updateMany({
      where: { id: emailId, prospectId: id },
      data: { sentAt: new Date() },
    })

    return NextResponse.json(proposal)
  } catch (error) {
    console.error('Mark sent error:', error)
    return NextResponse.json({ error: 'Error al marcar como enviado' }, { status: 500 })
  }
}
