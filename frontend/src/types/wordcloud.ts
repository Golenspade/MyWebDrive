export type WordMode = 'mygo' | 'ave'

export interface WordEntry {
  text: string
  frequency: number
}

export interface CloudItem extends WordEntry {
  id: string
  size: number // font size in px
  color: string
  direction: 'lr' | 'rl' | 'tb' | 'bt' // left->right, right->left, top->bottom, bottom->top
  baseDuration: number // seconds for one loop at 1x speed
  x: number // initial x (px)
  y: number // initial y (px)
}

