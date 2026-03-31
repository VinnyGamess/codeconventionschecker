using System;
using UnityEngine;

namespace SampleAttributes
{
    // Test: attribute parsing
    [System.Serializable]
    public class InventoryItem
    {
        // Has [SerializeField] — should NOT trigger CQE009
        [SerializeField] private string _itemName;

        // Has [SerializeField] — should NOT trigger CQE009
        [SerializeField]
        private int _quantity;

        // Multiple attributes
        [Header("Display")]
        [Tooltip("Max stack size")]
        [SerializeField] private int _maxStack;

        // Public field WITHOUT [SerializeField] — CQE009 should trigger
        public float weight;

        // Public field with attribute but not SerializeField — CQE009 triggers
        [Obsolete]
        public string description;

        // OK: const
        public const int MaxInventorySize = 20;

        public void AddItem()
        {
            _quantity++;
        }

        // CQE004: method not PascalCase
        public void remove_item()
        {
            _quantity--;
        }
    }
}
