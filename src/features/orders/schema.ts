import { z } from 'zod'

export const ORDER_STATUSES = ['received', 'cutting', 'stitching', 'trial', 'ready', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** The normal forward pipeline (cancelled sits outside it). */
export const PIPELINE: OrderStatus[] = ['received', 'cutting', 'stitching', 'trial', 'ready', 'delivered']

/** Still being worked on, or waiting for pickup. */
export const OPEN_STATUSES: OrderStatus[] = ['received', 'cutting', 'stitching', 'trial', 'ready']

const money = z.number().min(0).max(10_000_000)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalIsoDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/)

export const orderAddOnSchema = z.object({
  addOnId: z.string(),
  name: z.string().trim().min(1).max(60),
  rate: money,
})
export type OrderAddOn = z.infer<typeof orderAddOnSchema>

export const orderItemSchema = z.object({
  garmentTypeId: z.string().min(1),
  /** Snapshot so old orders read right after the master list is edited. */
  garmentName: z.string().trim().min(1).max(60),
  qty: z.number().int().min(1).max(100),
  rate: money,
  addOns: z.array(orderAddOnSchema).max(20),
  fabricByCustomer: z.boolean(),
  fabricNotes: z.string().trim().max(300),
  notes: z.string().trim().max(500),
  /** Measurements used for this item, copied at order time. */
  measurementId: z.string().nullable(),
  measurementTakenOn: z.string().nullable(),
  measurements: z.record(z.string(), z.string().max(20)),
  designPhotoUrl: z.string().url().nullable(),
})
export type OrderItem = z.infer<typeof orderItemSchema>

export const statusChangeSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  /** Local date-time ISO string of the change (for on-time reports). */
  at: z.string(),
  by: z.string(),
})
export type StatusChange = z.infer<typeof statusChangeSchema>

export const orderSchema = z.object({
  orderNumber: z.string().min(1).max(40),
  customerId: z.string().min(1),
  /** Snapshots for lists and bills. */
  customerName: z.string().trim().min(1).max(80),
  customerPhone: z.string().max(15),
  items: z.array(orderItemSchema).min(1).max(50),
  orderDate: isoDate,
  trialDate: optionalIsoDate,
  deliveryDate: isoDate,
  status: z.enum(ORDER_STATUSES),
  statusHistory: z.array(statusChangeSchema).max(100),
  urgent: z.boolean(),
  karigarId: z.string().nullable(),
  notes: z.string().trim().max(1000),
})
export type Order = z.infer<typeof orderSchema>

/** Per-device order counter (counters/device-<letter>). */
export const deviceCounterSchema = z.object({
  letter: z.string().regex(/^[A-Z]{1,2}$/),
  deviceLabel: z.string().max(80),
  claimedBy: z.string(),
  fy: z.string().regex(/^\d{2}-\d{2}$/),
  seq: z.number().int().min(0),
})
export type DeviceCounter = z.infer<typeof deviceCounterSchema>
