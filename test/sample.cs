using System;
using System.Collections.Generic;

namespace SampleApp
{
    // CQE003 violation: class name not PascalCase
    public class myBadClass
    {
        // CQE001 violation: public field
        public int Score;

        // CQE006 violation: private field not _camelCase
        private string name;

        // CQE006 OK: correctly named private field
        private int _age;

        // CQE002 violation: no access modifier on field
        string Address;

        // CQE001 + CQE006: public field
        public string Data;

        // OK: public const is allowed
        public const int MaxRetries = 5;

        // OK: public static readonly is allowed
        public static readonly string DefaultName = "Unknown";

        // CQE004 violation: method not PascalCase
        public void calculate_total()
        {
            // CQE005 violation: variable not camelCase
            int TotalAmount = 100; // CQE008 violation: magic number 100

            // CQE005 OK: correctly named variable
            int itemCount = 0;

            // CQE008 OK: 0 and 1 are allowed
            int start = 0;
            int increment = 1;

            // CQE008 violation: magic number 42
            int answer = 42;

            if (answer > 0)
            {
                // CQE005 violation: variable not camelCase
                var BadResult = answer * 2; // CQE008: magic number 2
            }
        }

        // CQE002 violation: no access modifier on method
        void DoSomething()
        {
            // CQE008 violation: magic number 3.14
            double pi = 3.14;
        }

        // CQE004 OK: PascalCase method
        public int GetScore()
        {
            return _age;
        }
    }

    // CQE002 violation: no access modifier on class
    class HiddenClass
    {
        // CQE006 violation: private field not _camelCase
        private int counter;

        public HiddenClass()
        {
            counter = 0;
        }
    }

    // CQE003 OK: PascalCase
    public class GoodService
    {
        private readonly int _timeout;

        public GoodService(int timeout)
        {
            _timeout = timeout;
        }

        public void Process()
        {
            var items = new List<string>();
            int count = items.Count;
        }
    }

    /* Multi-line comment with "fake code":
       public int shouldBeIgnored = 999;
       This shouldn't trigger any rules. */

    // Enum — numbers inside enum should NOT trigger CQE008
    public enum Status
    {
        Active = 10,
        Inactive = 20,
        Deleted = 30
    }
}
