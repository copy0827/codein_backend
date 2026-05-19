from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import calendar
from typing import Iterable, List, Optional

from app.models.event import Event


@dataclass(frozen=True)
class OccurrenceWindow:
    start_time: datetime
    end_time: datetime


def add_months(dt: datetime, months: int) -> datetime:
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _strip_tz(dt: datetime) -> datetime:
    """Remove timezone info for safe comparison."""
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def generate_occurrences(
    event: Event,
    range_start: datetime,
    range_end: datetime,
) -> List[OccurrenceWindow]:
    # Normalize all datetimes to naive for safe comparison
    rs = _strip_tz(range_start)
    re = _strip_tz(range_end)
    ev_start = _strip_tz(event.start_time)
    ev_end = _strip_tz(event.end_time)

    if not event.recurrence_type:
        if ev_start <= re and ev_end >= rs:
            return [OccurrenceWindow(event.start_time, event.end_time)]
        return []

    interval = max(event.recurrence_interval or 1, 1)
    until = _strip_tz(event.recurrence_end_date) if event.recurrence_end_date else None
    count_limit = event.recurrence_count
    duration = ev_end - ev_start

    occurrences: List[OccurrenceWindow] = []
    current = ev_start
    generated = 0

    while current <= re:
        if until and current > until:
            break
        if count_limit is not None and generated >= count_limit:
            break

        if current + duration >= rs and current <= re:
            occurrences.append(OccurrenceWindow(current, current + duration))

        generated += 1

        if event.recurrence_type == "daily":
            current += timedelta(days=interval)
        elif event.recurrence_type == "weekly":
            current += timedelta(weeks=interval)
        elif event.recurrence_type == "monthly":
            current = add_months(current, interval)
        else:
            break

    return occurrences


def expand_events(
    events: Iterable[Event],
    range_start: datetime,
    range_end: datetime,
) -> List[tuple[Event, OccurrenceWindow]]:
    expanded: List[tuple[Event, OccurrenceWindow]] = []
    for event in events:
        for window in generate_occurrences(event, range_start, range_end):
            expanded.append((event, window))
    return expanded
