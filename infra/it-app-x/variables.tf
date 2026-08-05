variable "subscription_id" {
  description = "Azure subscription ID (simulated)"
  type        = string
  default     = "sub-simulated-001"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "westeurope"
}

variable "app_id" {
  description = "Application identifier"
  type        = string
  default     = "APP-X-001"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}
