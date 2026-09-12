"""Simulation engine error types. Never swallowed — a service layer catches
these to update SimulationRun.status/error_message, but always re-raises
(see docs/development/simulation.md)."""


class SimulationError(Exception):
    """Base class for every error the simulation engine raises."""


class SimulationConfigError(SimulationError):
    """The scenario/timestep configuration is invalid — a client input
    problem (unknown disaster_type, non-positive timestep, etc.)."""


class SimulationExecutionError(SimulationError):
    """A disaster model failed while initializing or stepping — a model bug,
    not a client input problem."""
