using System;
using System.Collections.Generic;

namespace HeuristicTestSamples
{
    // CQE011: class with Dutch name
    public class SpelerBeheer
    {
        // CQE011: Dutch field name
        private int _snelheid;

        // CQE011: placeholder name
        public int test;

        // CQE011: placeholder name
        private string _foo;

        // CQE011: keyboard walk
        private int _asdf;

        // CQE011: digit suffix (lazy naming)
        private int _data1;

        // CQE011: very short name
        private int _q;

        // OK: good English name
        private int _playerHealth;

        // OK: good English name
        private string _userName;

        // CQE011: non-English (Dutch) name
        private float _breedteScherm;

        // CQE011: mixed language (English + Dutch)
        public void GetSpelerNaam()
        {
            // CQE011: bad variable name
            int abc = 0;

            // CQE011: bad variable name
            string tmp = "hello";

            // OK: standard loop var
            for (int i = 0; i < 1; i++)
            {
            }

            // CQE011: all same character
            int aaa = 1;

            // CQE011: Dutch variable
            int teller = 0;
        }

        // OK: good PascalCase English
        public void CalculateDamage()
        {
            int damageAmount = 0;
        }

        // CQE011: placeholder method name
        public void DoStuff()
        {
        }
    }

    // OK: good English class name
    public class InventoryManager
    {
        private List<string> _items;

        public void AddItem()
        {
        }
    }
}
