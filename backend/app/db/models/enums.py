import enum


class DisasterType(str, enum.Enum):
    """The architecture must support all of these equally — no disaster type is a special case."""

    FLOOD = "flood"
    FLASH_FLOOD = "flash_flood"
    COASTAL_FLOOD = "coastal_flood"
    STORM_SURGE = "storm_surge"
    CYCLONE = "cyclone"
    TSUNAMI = "tsunami"
    OIL_SPILL = "oil_spill"
    CHEMICAL_POLLUTION = "chemical_pollution"
    SEARCH_RESCUE = "search_rescue"


class ScenarioStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class SimulationStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class RiskCategory(str, enum.Enum):
    OVERALL = "overall"
    POPULATION = "population"
    INFRASTRUCTURE = "infrastructure"
    ENVIRONMENTAL = "environmental"
    ECONOMIC = "economic"
    EVACUATION = "evacuation"
    ACCESSIBILITY = "accessibility"


class VulnerabilityLevel(str, enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class RecommendationPriority(str, enum.Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class RecommendationStatus(str, enum.Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    IMPLEMENTED = "implemented"


class RecommendationSource(str, enum.Enum):
    """Recommendations don't always come from an LLM — see CLAUDE.md §5."""

    RULE_BASED = "rule_based"
    SIMULATION_ANALYSIS = "simulation_analysis"
    AI_AGENT = "ai_agent"
    HUMAN_OPERATOR = "human_operator"


class AssetType(str, enum.Enum):
    HOSPITAL = "hospital"
    POLICE_STATION = "police_station"
    FIRE_STATION = "fire_station"
    SHELTER = "shelter"
    PORT = "port"
    AIRPORT = "airport"
    BRIDGE = "bridge"
    ROAD = "road"
    POWER_STATION = "power_station"
    WATER_TREATMENT_FACILITY = "water_treatment_facility"
    EMERGENCY_OPERATIONS_CENTER = "emergency_operations_center"


class AssetCriticality(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ArtifactType(str, enum.Enum):
    NETCDF = "netcdf"
    ZARR = "zarr"
    GEOTIFF = "geotiff"
    JSON = "json"
    OTHER = "other"


class EventType(str, enum.Enum):
    SCENARIO_CREATED = "scenario_created"
    SCENARIO_MODIFIED = "scenario_modified"
    SIMULATION_STARTED = "simulation_started"
    SIMULATION_COMPLETED = "simulation_completed"
    RISK_RECALCULATED = "risk_recalculated"
    AI_ANALYSIS_EXECUTED = "ai_analysis_executed"
    RECOMMENDATION_GENERATED = "recommendation_generated"
    RESPONSE_PLAN_GENERATED = "response_plan_generated"
