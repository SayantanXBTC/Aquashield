"""Common interface every disaster model implements. SimulationEngine depends
only on this abstraction — it never contains disaster-specific logic
(Prompt 7 §5/§10). Every concrete model is a SIMPLIFIED DEMONSTRATION MODEL:
see `describe()` and docs/development/simulation.md — none of these are
scientifically validated for operational forecasting."""

from __future__ import annotations

from abc import ABC, abstractmethod
from random import Random
from typing import Any, ClassVar

from simulation.core.time import SimulationClock


class DisasterModel(ABC):
    model_identifier: ClassVar[str]
    disaster_type: ClassVar[str]
    assumptions: ClassVar[list[str]] = []

    def __init__(
        self,
        *,
        config: dict[str, Any],
        clock: SimulationClock,
        location: dict[str, float] | None,
        rng: Random,
    ) -> None:
        self.config = config
        self.clock = clock
        self.location = location
        self.rng = rng

    @abstractmethod
    def initialize(self) -> None:
        """Validate/derive initial state from `self.config`. Called once,
        before any `step()`."""

    @abstractmethod
    def step(self, timestep: int) -> None:
        """Advance internal state to `timestep` (1-indexed; `timestep=0` is
        the state produced by `initialize()`, not a `step()` call)."""

    @abstractmethod
    def get_state(
        self, timestep: int
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        """Returns (environmental_state, hazard_state, affected_area) for the
        current internal state — called immediately after `initialize()`/`step()`
        for the same `timestep`."""

    def is_complete(self, timestep: int) -> bool:
        """Default: complete once the scenario's configured duration has
        elapsed. Override for a model with a genuine early-stop condition."""
        return timestep >= self.clock.total_steps

    def is_key_event(self, timestep: int) -> bool:
        """Override to flag a timestep as notable (e.g. tsunami coastal
        arrival) beyond the engine's own first/last-frame marking."""
        return False

    @classmethod
    def describe(cls) -> dict[str, Any]:
        return {
            "model_identifier": cls.model_identifier,
            "disaster_type": cls.disaster_type,
            "type": "SIMPLIFIED DEMONSTRATION MODEL",
            "purpose": "Interactive visualization and system demonstration",
            "scientific_validation": "Not validated for operational forecasting",
            "assumptions": cls.assumptions,
        }
