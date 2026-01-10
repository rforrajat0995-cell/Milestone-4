/**
 * Session Model
 */

import { STATES } from '../services/domain/dialogStateMachine.js';

export class Session {
  constructor(data = {}) {
    this.sessionId = data.sessionId || null;
    this.state = data.state || STATES.GREETING;
    this.intent = data.intent || null;
    this.topic = data.topic || null;
    this.preferences = data.preferences || {};
    this.offeredSlots = data.offeredSlots || [];
    this.selectedSlot = data.selectedSlot || null;
    this.bookingCode = data.bookingCode || null;
    this.bookingCodeToReschedule = data.bookingCodeToReschedule || null;
    this.bookingCodeToCancel = data.bookingCodeToCancel || null;
    this.cancellationPending = data.cancellationPending || false;
    this.reschedulePending = data.reschedulePending || false;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      state: this.state,
      intent: this.intent,
      topic: this.topic,
      preferences: this.preferences,
      offeredSlots: this.offeredSlots,
      selectedSlot: this.selectedSlot,
      bookingCode: this.bookingCode,
      bookingCodeToReschedule: this.bookingCodeToReschedule,
      bookingCodeToCancel: this.bookingCodeToCancel,
      cancellationPending: this.cancellationPending,
      reschedulePending: this.reschedulePending,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  update(data) {
    Object.assign(this, data);
    this.updatedAt = new Date().toISOString();
    return this;
  }

  reset() {
    this.state = STATES.GREETING;
    this.intent = null;
    this.topic = null;
    this.preferences = {};
    this.offeredSlots = [];
    this.selectedSlot = null;
    this.bookingCode = null;
    this.bookingCodeToReschedule = null;
    this.bookingCodeToCancel = null;
    this.cancellationPending = false;
    this.reschedulePending = false;
    this.updatedAt = new Date().toISOString();
    return this;
  }
}

