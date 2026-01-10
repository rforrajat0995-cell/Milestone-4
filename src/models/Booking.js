/**
 * Booking Model
 */

export class Booking {
  constructor(data = {}) {
    this.bookingCode = data.bookingCode || null;
    this.topic = data.topic || null;
    this.date = data.date || null;
    this.time = data.time || null;
    this.status = data.status || 'confirmed';
    this.calendarEventId = data.calendarEventId || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      bookingCode: this.bookingCode,
      topic: this.topic,
      date: this.date,
      time: this.time,
      status: this.status,
      calendarEventId: this.calendarEventId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  update(data) {
    Object.assign(this, data);
    this.updatedAt = new Date().toISOString();
    return this;
  }

  cancel() {
    this.status = 'cancelled';
    this.updatedAt = new Date().toISOString();
    return this;
  }
}

