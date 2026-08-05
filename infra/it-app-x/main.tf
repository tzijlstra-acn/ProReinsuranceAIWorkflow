# IT App X — Main Infrastructure
# Managed by: Platform Engineering
# Application: APP-X-001 (Claims Processing)
# Last updated: 2025-01-10

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-app-x-prod"
  location = var.location
  tags     = local.common_tags
}

resource "azurerm_virtual_machine" "app_x_vm" {
  name                = "vm-app-x-001"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  vm_size             = "Standard_D4s_v3"
  tags                = local.common_tags
}

resource "azurerm_storage_account" "app_x_storage" {
  name                     = "stappx001"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  tags                     = local.common_tags
}

locals {
  common_tags = {
    app_id      = var.app_id
    environment = var.environment
    managed_by  = "terraform"
  }
}
